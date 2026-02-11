const express = require("express");

const { getDatabase } = require("../db/database");
const { extractOpportunityFiltersWithAI, generateChatReply } = require("../services/ai-service");
const {
  createSession,
  getAuthUserFromRequest,
  issueLoginCode,
  normalizeEmail,
  parseBearerToken,
  revokeSession,
  upsertUserByEmail,
  verifyLoginCode
} = require("../services/auth-service");
const { sendOtpEmail } = require("../services/mail-service");
const { normalizeFilters, mergeFilters } = require("../services/filter-service");
const { getOpportunityById, listOpportunities } = require("../services/opportunity-service");

const router = express.Router();

const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || "admin@kutlewe.az");
const ADMIN_ACCESS_CODE = String(process.env.ADMIN_ACCESS_CODE || "KutleWeAdmin2026").trim();

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

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    headline: user.headline,
    about: user.about,
    location: user.location,
    skills: user.skills ? user.skills.split(",").map((item) => item.trim()).filter(Boolean) : [],
    linkedin_url: user.linkedin_url,
    avatar_url: user.avatar_url,
    is_admin: Number(user.is_admin) === 1,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

async function requireUser(req, res) {
  const db = getDatabase();
  const user = await getAuthUserFromRequest(db, req);
  if (!user) {
    res.status(401).json({ message: "Evvelce daxil olmalisiniz." });
    return null;
  }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) {
    return null;
  }
  if (Number(user.is_admin) !== 1) {
    res.status(403).json({ message: "Bu emeliyyat yalniz admin ucundur." });
    return null;
  }
  return user;
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
        (SELECT COUNT(*) FROM thread_replies) as replies,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM announcements WHERE is_approved = 1) as announcements,
        (SELECT COUNT(*) FROM chat_groups) as groups
    `);

    const latestAnnouncements = await db.all(`
      SELECT
        a.id,
        a.title,
        a.body,
        a.created_at,
        u.name as author_name
      FROM announcements a
      JOIN users u ON u.id = a.author_user_id
      WHERE a.is_approved = 1
      ORDER BY datetime(a.created_at) DESC
      LIMIT 4
    `);

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
      latestAnnouncements,
      latestThreads
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/request-code", async (req, res, next) => {
  try {
    const db = getDatabase();
    const email = normalizeEmail(req.body?.email);
    const purpose = cleanText(req.body?.purpose || "login", 20);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Email format duzgun deyil." });
    }

    await upsertUserByEmail(db, email, cleanText(req.body?.name, 80));
    const issued = await issueLoginCode(db, email, purpose);
    const mailResult = await sendOtpEmail(email, issued.code, purpose);

    res.json({
      ok: true,
      expiresAt: issued.expiresAt,
      delivered: mailResult.delivered,
      message: mailResult.message,
      debugCode: mailResult.delivered ? undefined : issued.code
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/reset-code", async (req, res, next) => {
  try {
    const db = getDatabase();
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Email format duzgun deyil." });
    }

    await upsertUserByEmail(db, email, cleanText(req.body?.name, 80));
    const issued = await issueLoginCode(db, email, "login");
    const mailResult = await sendOtpEmail(email, issued.code, "login");

    res.json({
      ok: true,
      expiresAt: issued.expiresAt,
      delivered: mailResult.delivered,
      message: "Yeni kod gonderildi.",
      debugCode: mailResult.delivered ? undefined : issued.code
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/verify-code", async (req, res, next) => {
  try {
    const db = getDatabase();
    const email = normalizeEmail(req.body?.email);
    const code = cleanText(req.body?.code, 8);
    const name = cleanText(req.body?.name, 80);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Email format duzgun deyil." });
    }
    if (code.length < 4) {
      return res.status(400).json({ message: "Kod duzgun deyil." });
    }

    const verification = await verifyLoginCode(db, email, code, "login");
    if (!verification.ok) {
      return res.status(400).json({ message: verification.reason });
    }

    const user = await upsertUserByEmail(db, email, name);
    const session = await createSession(db, user.id);

    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: toPublicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/admin-login", async (req, res, next) => {
  try {
    const db = getDatabase();
    const email = normalizeEmail(req.body?.email);
    const accessCode = cleanText(req.body?.accessCode, 120);

    if (email !== ADMIN_EMAIL || accessCode !== ADMIN_ACCESS_CODE) {
      return res.status(403).json({ message: "Admin melumatlari yanlisdir." });
    }

    const user = await upsertUserByEmail(db, email, "KutleWe Admin");
    await db.run(
      "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );
    const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [user.id]);
    const session = await createSession(db, updatedUser.id);

    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: toPublicUser(updatedUser)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", async (req, res, next) => {
  try {
    const db = getDatabase();
    const user = await getAuthUserFromRequest(db, req);
    if (!user) {
      return res.status(401).json({ message: "Sessiya tapilmadi." });
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    const db = getDatabase();
    const token = parseBearerToken(req);
    if (token) {
      await revokeSession(db, token);
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/profile/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "User id duzgun deyil." });
    }
    const db = getDatabase();
    const user = await db.get(
      `
        SELECT id, name, headline, about, location, skills, linkedin_url, avatar_url, created_at
        FROM users
        WHERE id = ?
      `,
      [id]
    );
    if (!user) {
      return res.status(404).json({ message: "Istifadeci tapilmadi." });
    }

    const stats = await db.get(
      `
        SELECT
          (SELECT COUNT(*) FROM announcements WHERE author_user_id = ?) as announcements,
          (SELECT COUNT(*) FROM threads WHERE author = ?) as threads
      `,
      [id, user.name]
    );

    res.json({
      user: {
        ...user,
        skills: user.skills ? user.skills.split(",").map((s) => s.trim()).filter(Boolean) : []
      },
      stats
    });
  } catch (error) {
    next(error);
  }
});

router.get("/profile/me", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put("/profile/me", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const db = getDatabase();

    const name = cleanText(req.body?.name || user.name, 80) || "Istifadeci";
    const headline = cleanText(req.body?.headline, 120);
    const about = cleanText(req.body?.about, 2000);
    const location = cleanText(req.body?.location, 120);
    const linkedinUrl = cleanText(req.body?.linkedin_url, 240);
    const avatarUrl = cleanText(req.body?.avatar_url, 240);

    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills
      : String(req.body?.skills || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const compactSkills = skills.slice(0, 30).join(", ");

    await db.run(
      `
        UPDATE users
        SET
          name = ?,
          headline = ?,
          about = ?,
          location = ?,
          skills = ?,
          linkedin_url = ?,
          avatar_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [name, headline, about, location, compactSkills, linkedinUrl, avatarUrl, user.id]
    );

    const updated = await db.get("SELECT * FROM users WHERE id = ?", [user.id]);
    res.json({ user: toPublicUser(updated) });
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
      return res.status(400).json({ message: "ID deyeri duzgun deyil." });
    }

    const db = getDatabase();
    const opportunity = await getOpportunityById(db, id);
    if (!opportunity) {
      return res.status(404).json({ message: "Furset tapilmadi." });
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
      return res.status(400).json({ message: "AI filtr ucun prompt bos ola bilmez." });
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
    const db = getDatabase();
    const authUser = await getAuthUserFromRequest(db, req);

    const title = cleanText(req.body?.title, 170);
    const body = cleanText(req.body?.body, 2000);
    const author = cleanText(req.body?.author, 60) || authUser?.name || "Anonim";
    const tag = cleanText(req.body?.tag, 30);

    if (title.length < 8) {
      return res.status(400).json({ message: "Movzu basligi en azi 8 simvol olmalidir." });
    }
    if (body.length < 15) {
      return res.status(400).json({ message: "Movzu tesviri en azi 15 simvol olmalidir." });
    }

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
      return res.status(400).json({ message: "Thread ID duzgun deyil." });
    }

    const db = getDatabase();
    const thread = await db.get("SELECT * FROM threads WHERE id = ?", [id]);
    if (!thread) {
      return res.status(404).json({ message: "Thread tapilmadi." });
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
      return res.status(400).json({ message: "Thread ID duzgun deyil." });
    }

    const db = getDatabase();
    const authUser = await getAuthUserFromRequest(db, req);
    const author = cleanText(req.body?.author, 60) || authUser?.name || "Anonim";
    const body = cleanText(req.body?.body, 1200);

    if (body.length < 3) {
      return res.status(400).json({ message: "Cavab en azi 3 simvol olmalidir." });
    }

    const thread = await db.get("SELECT id FROM threads WHERE id = ?", [threadId]);
    if (!thread) {
      return res.status(404).json({ message: "Cavab yazmaq ucun thread tapilmadi." });
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

router.get("/community/announcements", async (req, res, next) => {
  try {
    const db = getDatabase();
    const authUser = await getAuthUserFromRequest(db, req);
    const isAdmin = Number(authUser?.is_admin) === 1;

    let rows;
    if (isAdmin) {
      rows = await db.all(`
        SELECT
          a.id,
          a.title,
          a.body,
          a.is_approved,
          a.created_at,
          u.id as author_id,
          u.name as author_name
        FROM announcements a
        JOIN users u ON u.id = a.author_user_id
        ORDER BY datetime(a.created_at) DESC
      `);
    } else {
      rows = await db.all(
        `
          SELECT
            a.id,
            a.title,
            a.body,
            a.is_approved,
            a.created_at,
            u.id as author_id,
            u.name as author_name
          FROM announcements a
          JOIN users u ON u.id = a.author_user_id
          WHERE a.is_approved = 1
             OR (? IS NOT NULL AND a.author_user_id = ?)
          ORDER BY datetime(a.created_at) DESC
        `,
        [authUser?.id || null, authUser?.id || null]
      );
    }

    res.json({
      total: rows.length,
      announcements: rows
    });
  } catch (error) {
    next(error);
  }
});

router.post("/community/announcements", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const db = getDatabase();
    const title = cleanText(req.body?.title, 160);
    const body = cleanText(req.body?.body, 3000);

    if (title.length < 6) {
      return res.status(400).json({ message: "Elan basligi en azi 6 simvol olmalidir." });
    }
    if (body.length < 12) {
      return res.status(400).json({ message: "Elan metni en azi 12 simvol olmalidir." });
    }

    const isApproved = Number(user.is_admin) === 1 ? 1 : 0;
    const result = await db.run(
      `
        INSERT INTO announcements (title, body, author_user_id, is_approved)
        VALUES (?, ?, ?, ?)
      `,
      [title, body, user.id, isApproved]
    );

    const created = await db.get("SELECT * FROM announcements WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch("/community/announcements/:id/approve", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) {
      return;
    }
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Elan id duzgun deyil." });
    }

    const db = getDatabase();
    const approved = Number(req.body?.approved) === 1 ? 1 : 0;

    const existing = await db.get("SELECT id FROM announcements WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ message: "Elan tapilmadi." });
    }

    await db.run(
      `
        UPDATE announcements
        SET is_approved = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [approved, id]
    );

    const updated = await db.get("SELECT * FROM announcements WHERE id = ?", [id]);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/community/groups", async (req, res, next) => {
  try {
    const db = getDatabase();
    const user = await getAuthUserFromRequest(db, req);

    const groups = await db.all(
      `
        SELECT
          g.id,
          g.name,
          g.description,
          g.is_public,
          g.created_at,
          COUNT(m.user_id) as member_count
        FROM chat_groups g
        LEFT JOIN group_members m ON m.group_id = g.id
        WHERE g.is_public = 1
           OR (? IS NOT NULL AND EXISTS (
                SELECT 1 FROM group_members gm
                WHERE gm.group_id = g.id AND gm.user_id = ?
              ))
        GROUP BY g.id
        ORDER BY g.id ASC
      `,
      [user?.id || null, user?.id || null]
    );

    res.json({
      total: groups.length,
      groups
    });
  } catch (error) {
    next(error);
  }
});

router.post("/community/groups", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const db = getDatabase();
    const name = cleanText(req.body?.name, 80);
    const description = cleanText(req.body?.description, 300);
    const isPublic = Number(req.body?.is_public) === 0 ? 0 : 1;

    if (name.length < 3) {
      return res.status(400).json({ message: "Qrup adi en azi 3 simvol olmalidir." });
    }

    const result = await db.run(
      `
        INSERT INTO chat_groups (name, description, is_public, creator_user_id)
        VALUES (?, ?, ?, ?)
      `,
      [name, description, isPublic, user.id]
    );

    await db.run(
      `
        INSERT OR IGNORE INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'owner')
      `,
      [result.lastID, user.id]
    );

    const created = await db.get("SELECT * FROM chat_groups WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/community/groups/:id/join", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const db = getDatabase();
    const groupId = parseId(req.params.id);
    if (!groupId) {
      return res.status(400).json({ message: "Qrup id duzgun deyil." });
    }

    const group = await db.get("SELECT * FROM chat_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "Qrup tapilmadi." });
    }

    await db.run(
      `
        INSERT OR IGNORE INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'member')
      `,
      [groupId, user.id]
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/community/groups/:id/messages", async (req, res, next) => {
  try {
    const db = getDatabase();
    const groupId = parseId(req.params.id);
    if (!groupId) {
      return res.status(400).json({ message: "Qrup id duzgun deyil." });
    }

    const group = await db.get("SELECT * FROM chat_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "Qrup tapilmadi." });
    }

    const limitRaw = Number(req.query?.limit || 60);
    const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(limitRaw, 150)) : 60;

    const messages = await db.all(
      `
        SELECT
          gm.id,
          gm.group_id,
          gm.body,
          gm.created_at,
          u.id as user_id,
          u.name as user_name
        FROM group_messages gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY gm.id DESC
        LIMIT ?
      `,
      [groupId, limit]
    );

    res.json({
      total: messages.length,
      messages: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
});

router.post("/community/groups/:id/messages", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const db = getDatabase();
    const groupId = parseId(req.params.id);
    const body = cleanText(req.body?.body, 2000);

    if (!groupId) {
      return res.status(400).json({ message: "Qrup id duzgun deyil." });
    }
    if (body.length < 1) {
      return res.status(400).json({ message: "Mesaj bos ola bilmez." });
    }

    const group = await db.get("SELECT * FROM chat_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "Qrup tapilmadi." });
    }

    await db.run(
      `
        INSERT OR IGNORE INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'member')
      `,
      [groupId, user.id]
    );

    const result = await db.run(
      `
        INSERT INTO group_messages (group_id, user_id, body)
        VALUES (?, ?, ?)
      `,
      [groupId, user.id, body]
    );

    const created = await db.get(
      `
        SELECT
          gm.id,
          gm.group_id,
          gm.body,
          gm.created_at,
          u.id as user_id,
          u.name as user_name
        FROM group_messages gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.id = ?
      `,
      [result.lastID]
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/chat", async (req, res, next) => {
  try {
    const message = cleanText(req.body?.message, 600);
    if (!message) {
      return res.status(400).json({ message: "Mesaj bos ola bilmez." });
    }

    const db = getDatabase();
    const counts = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM opportunities) as opportunities,
        (SELECT COUNT(*) FROM threads) as threads,
        (SELECT COUNT(*) FROM thread_replies) as replies,
        (SELECT COUNT(*) FROM announcements) as announcements
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
