const crypto = require("crypto");

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function parseBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  return header.slice(7).trim();
}

function getSessionExpiryIso() {
  const ttlMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ttlMs).toISOString();
}

async function upsertUserByEmail(db, email, name = "") {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("Email bos ola bilmez.");
  }

  const existing = await db.get("SELECT * FROM users WHERE email = ?", [normalized]);
  if (existing) {
    if (name && !existing.name) {
      await db.run(
        "UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name.slice(0, 80), existing.id]
      );
      return db.get("SELECT * FROM users WHERE id = ?", [existing.id]);
    }
    return existing;
  }

  const result = await db.run(
    `
      INSERT INTO users (email, name)
      VALUES (?, ?)
    `,
    [normalized, name ? name.slice(0, 80) : "Istifadeci"]
  );
  return db.get("SELECT * FROM users WHERE id = ?", [result.lastID]);
}

async function issueLoginCode(db, email, purpose = "login") {
  const normalized = normalizeEmail(email);
  const code = generateCode();
  const codeHash = hashValue(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.run(
    `
      UPDATE login_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE email = ? AND purpose = ? AND used_at IS NULL
    `,
    [normalized, purpose]
  );

  await db.run(
    `
      INSERT INTO login_codes (email, code_hash, purpose, expires_at)
      VALUES (?, ?, ?, ?)
    `,
    [normalized, codeHash, purpose, expiresAt]
  );

  return {
    email: normalized,
    code,
    expiresAt
  };
}

async function verifyLoginCode(db, email, code, purpose = "login") {
  const normalized = normalizeEmail(email);
  const codeHash = hashValue(String(code || "").trim());

  const row = await db.get(
    `
      SELECT *
      FROM login_codes
      WHERE email = ?
        AND purpose = ?
        AND code_hash = ?
        AND used_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [normalized, purpose, codeHash]
  );

  if (!row) {
    return { ok: false, reason: "Kod yanlisdir." };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "Kodun muddeti bitib." };
  }

  await db.run("UPDATE login_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
  return { ok: true };
}

async function createSession(db, userId) {
  const token = generateToken();
  const tokenHash = hashValue(token);
  const expiresAt = getSessionExpiryIso();

  await db.run(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at, last_seen_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [userId, tokenHash, expiresAt]
  );

  return {
    token,
    expiresAt
  };
}

async function revokeSession(db, token) {
  const tokenHash = hashValue(token);
  await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

async function getUserByToken(db, token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashValue(token);
  const row = await db.get(
    `
      SELECT
        s.id as session_id,
        s.expires_at,
        u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
      LIMIT 1
    `,
    [tokenHash]
  );

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.run("DELETE FROM sessions WHERE id = ?", [row.session_id]);
    return null;
  }

  await db.run("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?", [row.session_id]);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    headline: row.headline,
    about: row.about,
    location: row.location,
    skills: row.skills,
    linkedin_url: row.linkedin_url,
    avatar_url: row.avatar_url,
    is_admin: row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getAuthUserFromRequest(db, req) {
  const token = parseBearerToken(req);
  if (!token) {
    return null;
  }
  return getUserByToken(db, token);
}

module.exports = {
  createSession,
  getAuthUserFromRequest,
  getUserByToken,
  issueLoginCode,
  normalizeEmail,
  parseBearerToken,
  revokeSession,
  upsertUserByEmail,
  verifyLoginCode
};
