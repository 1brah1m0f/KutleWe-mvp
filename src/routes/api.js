const express = require("express");

const { getDatabase } = require("../db/database");
const { extractOpportunityFiltersWithAI, generateChatReply } = require("../services/ai-service");
const { normalizeFilters, mergeFilters } = require("../services/filter-service");
const { getOpportunityById, listOpportunities } = require("../services/opportunity-service");

const router = express.Router();

function parseId(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }
  return numericValue;
}

function cleanText(value, maxLength = 1500) {
  return String(value || "").trim().slice(0, maxLength);
}

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/summary", async (_req, res, next) => {
  try {
    const db = getDatabase();
    const counts = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM opportunities) as opportunities,
        (SELECT COUNT(*) FROM threads) as threads,
        (SELECT COUNT(*) FROM thread_replies) as replies
    `);

    const latestOpportunities = await db.all(
      "SELECT id, title, category_label, deadline_date FROM opportunities ORDER BY date(deadline_date) ASC LIMIT 4"
    );

    const latestThreads = await db.all(`
      SELECT
        t.id,
        t.title,
        t.author,
        t.created_at,
        COUNT(r.id) as reply_count
      FROM threads t
      LEFT JOIN thread_replies r ON r.thread_id = t.id
      GROUP BY t.id
      ORDER BY datetime(t.created_at) DESC
      LIMIT 4
    `);

    res.json({
      counts,
      latestOpportunities,
      latestThreads
    });
  } catch (error) {
    next(error);
  }
});

router.get("/opportunities", async (req, res, next) => {
  try {
    const db = getDatabase();
    const filters = normalizeFilters(req.query || {});
    const opportunities = await listOpportunities(db, filters);

    res.json({
      filters,
      total: opportunities.length,
      opportunities
    });
  } catch (error) {
    next(error);
  }
});

router.get("/opportunities/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID dəyəri düzgün deyil." });
    }

    const db = getDatabase();
    const opportunity = await getOpportunityById(db, id);
    if (!opportunity) {
      return res.status(404).json({ message: "Fürsət tapılmadı." });
    }

    res.json(opportunity);
  } catch (error) {
    next(error);
  }
});

router.post("/opportunities/ai-filter", async (req, res, next) => {
  try {
    const prompt = cleanText(req.body?.prompt, 280);
    if (!prompt) {
      return res.status(400).json({ message: "AI filtr üçün prompt boş ola bilməz." });
    }

    const db = getDatabase();
    const currentFilters = normalizeFilters(req.body?.currentFilters || {});
    const aiResult = await extractOpportunityFiltersWithAI(prompt);
    const mergedFilters = mergeFilters(currentFilters, aiResult.filters);
    const opportunities = await listOpportunities(db, mergedFilters);

    res.json({
      prompt,
      ai: aiResult,
      filters: mergedFilters,
      total: opportunities.length,
      opportunities
    });
  } catch (error) {
    next(error);
  }
});

router.get("/forum/threads", async (_req, res, next) => {
  try {
    const db = getDatabase();
    const threads = await db.all(`
      SELECT
        t.id,
        t.title,
        t.body,
        t.author,
        t.tag,
        t.created_at,
        COUNT(r.id) as reply_count,
        COALESCE(MAX(r.created_at), t.created_at) as last_activity
      FROM threads t
      LEFT JOIN thread_replies r ON r.thread_id = t.id
      GROUP BY t.id
      ORDER BY datetime(COALESCE(MAX(r.created_at), t.created_at)) DESC
    `);

    res.json({
      total: threads.length,
      threads
    });
  } catch (error) {
    next(error);
  }
});

router.post("/forum/threads", async (req, res, next) => {
  try {
    const title = cleanText(req.body?.title, 170);
    const body = cleanText(req.body?.body, 2000);
    const author = cleanText(req.body?.author || "Anonim", 60);
    const tag = cleanText(req.body?.tag, 30);

    if (title.length < 8) {
      return res.status(400).json({ message: "Mövzu başlığı ən azı 8 simvol olmalıdır." });
    }
    if (body.length < 15) {
      return res.status(400).json({ message: "Mövzu təsviri ən azı 15 simvol olmalıdır." });
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const result = await db.run(
      `
        INSERT INTO threads (title, body, author, tag, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [title, body, author, tag || null, now]
    );

    const created = await db.get("SELECT * FROM threads WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/forum/threads/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Thread ID düzgün deyil." });
    }

    const db = getDatabase();
    const thread = await db.get("SELECT * FROM threads WHERE id = ?", [id]);
    if (!thread) {
      return res.status(404).json({ message: "Thread tapılmadı." });
    }

    const replies = await db.all(
      `
        SELECT id, thread_id, author, body, created_at
        FROM thread_replies
        WHERE thread_id = ?
        ORDER BY datetime(created_at) ASC
      `,
      [id]
    );

    res.json({
      thread,
      replies
    });
  } catch (error) {
    next(error);
  }
});

router.post("/forum/threads/:id/replies", async (req, res, next) => {
  try {
    const threadId = parseId(req.params.id);
    if (!threadId) {
      return res.status(400).json({ message: "Thread ID düzgün deyil." });
    }

    const author = cleanText(req.body?.author || "Anonim", 60);
    const body = cleanText(req.body?.body, 1200);

    if (body.length < 3) {
      return res.status(400).json({ message: "Cavab ən azı 3 simvol olmalıdır." });
    }

    const db = getDatabase();
    const thread = await db.get("SELECT id FROM threads WHERE id = ?", [threadId]);
    if (!thread) {
      return res.status(404).json({ message: "Cavab yazmaq üçün thread tapılmadı." });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      `
        INSERT INTO thread_replies (thread_id, author, body, created_at)
        VALUES (?, ?, ?, ?)
      `,
      [threadId, author, body, now]
    );

    const created = await db.get("SELECT * FROM thread_replies WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/chat", async (req, res, next) => {
  try {
    const message = cleanText(req.body?.message, 600);
    if (!message) {
      return res.status(400).json({ message: "Mesaj boş ola bilməz." });
    }

    const db = getDatabase();
    const counts = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM opportunities) as opportunities,
        (SELECT COUNT(*) FROM threads) as threads,
        (SELECT COUNT(*) FROM thread_replies) as replies
    `);

    const context = {
      page: cleanText(req.body?.page, 80),
      counts
    };

    const reply = await generateChatReply(message, context);
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
