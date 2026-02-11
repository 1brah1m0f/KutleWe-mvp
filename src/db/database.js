const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const DB_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = path.join(DB_DIR, "kutlewe.db");

let dbInstance = null;

const opportunitySeed = [
  {
    title: "PASHA Bank Data Intern Program",
    organization: "PASHA Bank",
    categoryKey: "internship",
    categoryLabel: "Tecrube",
    location: "Baki",
    mode: "Hibrid",
    deadlineDate: "2026-03-15",
    duration: "3 ay",
    description: "Data analitika istiqametinde internship proqrami.",
    externalUrl: "https://example.com/opportunities/pasha-data-intern"
  },
  {
    title: "UNICEF Youth Volunteer Drive",
    organization: "UNICEF Azerbaycan",
    categoryKey: "volunteering",
    categoryLabel: "Konulluluk",
    location: "Baki",
    mode: "Onsite",
    deadlineDate: "2026-03-21",
    duration: "2 ay",
    description: "Genclerle sosial layihelerde istirak ve community desteyi.",
    externalUrl: "https://example.com/opportunities/unicef-volunteer"
  },
  {
    title: "CodeStorm 2026",
    organization: "TechHub Baki",
    categoryKey: "hackathon",
    categoryLabel: "Hakaton",
    location: "Baki",
    mode: "Onsite",
    deadlineDate: "2026-04-09",
    duration: "48 saat",
    description: "Komanda ile mehsul ideyasini prototipe cevir ve teqdim et.",
    externalUrl: "https://example.com/opportunities/codestorm-2026"
  },
  {
    title: "Career Launch Networking Night",
    organization: "ADA Career Center",
    categoryKey: "career",
    categoryLabel: "Karyera",
    location: "Baki",
    mode: "Onsite",
    deadlineDate: "2026-03-29",
    duration: "1 gun",
    description: "HR mutexessisleri ile networking sessiyasi.",
    externalUrl: "https://example.com/opportunities/career-launch-night"
  }
];

const threadSeed = [
  {
    title: "Hakatona komanda tapmaq ucun en yaxsi yol nedir?",
    body: "Discord ve LinkedIn qruplari ise yarayir? Tecrubesi olanlar addimlari yaza biler?",
    author: "Aylin",
    tag: "Hakaton",
    createdAt: "2026-02-10T10:15:00Z"
  },
  {
    title: "Data intern musahibesine nece hazirlasdiniz?",
    body: "SQL, Excel ve case-study suallarinda prioritet nece olmalidir?",
    author: "Tural",
    tag: "Tecrube",
    createdAt: "2026-02-10T07:40:00Z"
  }
];

const replySeedByThreadTitle = {
  "Hakatona komanda tapmaq ucun en yaxsi yol nedir?": [
    {
      author: "Rauf",
      body: "Evvel texniki stack uzre qisa yoxlama edin, sonra rol bolgusu qurin.",
      createdAt: "2026-02-10T12:05:00Z"
    }
  ],
  "Data intern musahibesine nece hazirlasdiniz?": [
    {
      author: "Murad",
      body: "Evvel SQL ve analitik dusunce, sonra mini case-study.",
      createdAt: "2026-02-10T09:02:00Z"
    }
  ]
};

async function createSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      organization TEXT NOT NULL,
      category_key TEXT NOT NULL,
      category_label TEXT NOT NULL,
      location TEXT NOT NULL,
      mode TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      duration TEXT,
      description TEXT NOT NULL,
      external_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      tag TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS thread_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Istifadeci',
      headline TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '',
      linkedin_url TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'login',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_user_id INTEGER NOT NULL,
      is_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 1,
      creator_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category_key);
    CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline_date);
    CREATE INDEX IF NOT EXISTS idx_threads_created ON threads(created_at);
    CREATE INDEX IF NOT EXISTS idx_replies_thread ON thread_replies(thread_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_codes_email ON login_codes(email);
    CREATE INDEX IF NOT EXISTS idx_codes_expires ON login_codes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_ann_author ON announcements(author_user_id);
    CREATE INDEX IF NOT EXISTS idx_groups_public ON chat_groups(is_public);
    CREATE INDEX IF NOT EXISTS idx_messages_group ON group_messages(group_id, created_at);
  `);
}

async function seedOpportunities(db) {
  const { count } = await db.get("SELECT COUNT(*) as count FROM opportunities");
  if (count > 0) {
    return;
  }

  const statement = await db.prepare(`
    INSERT INTO opportunities (
      title,
      organization,
      category_key,
      category_label,
      location,
      mode,
      deadline_date,
      duration,
      description,
      external_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of opportunitySeed) {
    await statement.run(
      item.title,
      item.organization,
      item.categoryKey,
      item.categoryLabel,
      item.location,
      item.mode,
      item.deadlineDate,
      item.duration,
      item.description,
      item.externalUrl
    );
  }

  await statement.finalize();
}

async function seedThreads(db) {
  const { count } = await db.get("SELECT COUNT(*) as count FROM threads");
  if (count > 0) {
    return;
  }

  const statement = await db.prepare(`
    INSERT INTO threads (title, body, author, tag, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const thread of threadSeed) {
    await statement.run(thread.title, thread.body, thread.author, thread.tag, thread.createdAt);
  }
  await statement.finalize();

  const replyCountRow = await db.get("SELECT COUNT(*) as count FROM thread_replies");
  if (replyCountRow.count > 0) {
    return;
  }

  const threads = await db.all("SELECT id, title FROM threads");
  const threadIdByTitle = new Map(threads.map((row) => [row.title, row.id]));
  const replyStatement = await db.prepare(`
    INSERT INTO thread_replies (thread_id, author, body, created_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const [title, replies] of Object.entries(replySeedByThreadTitle)) {
    const threadId = threadIdByTitle.get(title);
    if (!threadId) {
      continue;
    }
    for (const reply of replies) {
      await replyStatement.run(threadId, reply.author, reply.body, reply.createdAt);
    }
  }

  await replyStatement.finalize();
}

async function ensureDefaultAdminUser(db) {
  const adminEmail = String(process.env.ADMIN_EMAIL || "admin@kutlewe.az").trim().toLowerCase();
  if (!adminEmail) {
    return;
  }

  const existing = await db.get("SELECT id FROM users WHERE email = ?", [adminEmail]);
  if (existing) {
    await db.run(
      "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [existing.id]
    );
    return;
  }

  await db.run(
    `
      INSERT INTO users (email, name, is_admin)
      VALUES (?, ?, 1)
    `,
    [adminEmail, "KutleWe Admin"]
  );
}

async function ensureDefaultGroup(db) {
  const row = await db.get("SELECT COUNT(*) as count FROM chat_groups");
  if (row.count > 0) {
    return;
  }

  await db.run(
    `
      INSERT INTO chat_groups (name, description, is_public)
      VALUES (?, ?, 1)
    `,
    [
      "Umumi chat",
      "Butun istifadecilerin qoşula bildiyi aciq qrup."
    ]
  );
}

async function seedIfNeeded(db) {
  await seedOpportunities(db);
  await seedThreads(db);
  await ensureDefaultAdminUser(db);
  await ensureDefaultGroup(db);
}

async function initializeDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await dbInstance.exec("PRAGMA foreign_keys = ON;");
  await createSchema(dbInstance);
  await seedIfNeeded(dbInstance);

  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    throw new Error("Database initialize edilmeyib.");
  }
  return dbInstance;
}

module.exports = {
  DB_PATH,
  getDatabase,
  initializeDatabase
};
