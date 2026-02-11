const express = require("express");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

dotenv.config();

const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/db-test", async (_req, res) => {
  if (!pool) {
    return res.status(500).json({
      ok: false,
      error: "DATABASE_URL_MISSING",
      message: "DATABASE_URL env tapilmadi"
    });
  }

  try {
    const result = await pool.query("select now() as now");
    res.json({
      ok: true,
      now: result.rows?.[0]?.now || null
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "DB_CONNECTION_FAILED",
      message: error.message
    });
  }
});

app.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({
      ok: false,
      message: "message bos ola bilmez"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OPENAI_KEY_MISSING",
      message: "OPENAI_API_KEY env tapilmadi"
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Qisa ve faydali cavab ver."
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.6
    });

    res.json({
      ok: true,
      reply: completion.choices?.[0]?.message?.content || ""
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "OPENAI_REQUEST_FAILED",
      message: error.message
    });
  }
});

app.post("/smtp-test", async (req, res) => {
  const to = String(req.body?.to || "").trim();
  if (!to) {
    return res.status(400).json({ ok: false, message: "to email bos ola bilmez" });
  }

  const host = String(process.env.SMTP_HOST || "").trim();
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.SMTP_FROM || smtpUser || "").trim();

  if (!host || !smtpUser || !smtpPass) {
    return res.status(500).json({
      ok: false,
      message: "SMTP env deyiskenleri tam deyil"
    });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: "KutleWe SMTP test",
      text: "SMTP test email ugurla gonderildi."
    });

    res.json({
      ok: true,
      messageId: info.messageId
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Route tapilmadi: ${req.method} ${req.originalUrl}`
  });
});

const server = app.listen(port, () => {
  console.log(`Server isleyir: http://localhost:${port}`);
});

async function shutdown() {
  try {
    server.close();
    if (pool) {
      await pool.end();
    }
  } catch (_error) {
    // ignore shutdown errors
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
