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
    categoryLabel: "Təcrübə",
    location: "Bakı",
    mode: "Hibrid",
    deadlineDate: "2026-03-15",
    duration: "3 ay",
    description:
      "Data analitika istiqamətində internship proqramı. SQL, Excel və vizuallaşdırma bacarıqları üstünlükdür.",
    externalUrl: "https://example.com/opportunities/pasha-data-intern"
  },
  {
    title: "UNICEF Youth Volunteer Drive",
    organization: "UNICEF Azərbaycan",
    categoryKey: "volunteering",
    categoryLabel: "Könüllülük",
    location: "Bakı",
    mode: "Onsite",
    deadlineDate: "2026-03-21",
    duration: "2 ay",
    description:
      "Gənclərlə sosial layihələrdə iştirak, tədbir təşkilatına dəstək və community fəaliyyəti.",
    externalUrl: "https://example.com/opportunities/unicef-volunteer"
  },
  {
    title: "CodeStorm 2026",
    organization: "TechHub Bakı",
    categoryKey: "hackathon",
    categoryLabel: "Hakaton",
    location: "Bakı",
    mode: "Onsite",
    deadlineDate: "2026-04-09",
    duration: "48 saat",
    description:
      "Komanda ilə məhsul ideyasını prototipə çevir və münsiflər qarşısında təqdim et.",
    externalUrl: "https://example.com/opportunities/codestorm-2026"
  },
  {
    title: "Career Launch Networking Night",
    organization: "ADA Career Center",
    categoryKey: "career",
    categoryLabel: "Karyera tədbiri",
    location: "Bakı",
    mode: "Onsite",
    deadlineDate: "2026-03-29",
    duration: "1 gün",
    description:
      "HR mütəxəssisləri və şirkət nümayəndələri ilə networking sessiyası.",
    externalUrl: "https://example.com/opportunities/career-launch-night"
  },
  {
    title: "Azercell UX Internship",
    organization: "Azercell",
    categoryKey: "internship",
    categoryLabel: "Təcrübə",
    location: "Bakı",
    mode: "Hibrid",
    deadlineDate: "2026-04-05",
    duration: "4 ay",
    description:
      "UX research, wireframe və prototipləmə üzrə intern rolu. Figma təcrübəsi arzuolunandır.",
    externalUrl: "https://example.com/opportunities/azercell-ux-internship"
  },
  {
    title: "Green Future Volunteering Camp",
    organization: "EcoAction",
    categoryKey: "volunteering",
    categoryLabel: "Könüllülük",
    location: "Quba",
    mode: "Onsite",
    deadlineDate: "2026-04-12",
    duration: "2 gün",
    description:
      "Ətraf mühit yönümlü düşərgə. Yerli icma ilə ekoloji aksiyalar və maarifləndirmə.",
    externalUrl: "https://example.com/opportunities/green-future-camp"
  },
  {
    title: "Remote Product Analytics Internship",
    organization: "FintechX",
    categoryKey: "internship",
    categoryLabel: "Təcrübə",
    location: "Remote",
    mode: "Remote",
    deadlineDate: "2026-03-30",
    duration: "3 ay",
    description:
      "Remote intern proqramı. Product metrikaları, cohort analizi və dashboard qurulması.",
    externalUrl: "https://example.com/opportunities/remote-product-analytics"
  },
  {
    title: "Startup Weekend Gəncə",
    organization: "Innovation Hub",
    categoryKey: "hackathon",
    categoryLabel: "Hakaton",
    location: "Gəncə",
    mode: "Onsite",
    deadlineDate: "2026-04-18",
    duration: "3 gün",
    description:
      "Startap ideyasının inkişafı, mentor sessiyaları və final pitch gecəsi.",
    externalUrl: "https://example.com/opportunities/startup-weekend-gence"
  }
];

const threadSeed = [
  {
    title: "Hakatona komanda tapmaq üçün ən yaxşı yol nədir?",
    body: "Discord və LinkedIn qrupları işə yarayır? Təcrübəsi olanlar konkret addımları yaza bilər?",
    author: "Aylin",
    tag: "Hakaton",
    createdAt: "2026-02-10T10:15:00Z"
  },
  {
    title: "Data intern müsahibəsinə necə hazırlaşdınız?",
    body: "SQL, Excel, case-study və davranış sualları arasında prioriteti necə bölmək daha doğrudur?",
    author: "Tural",
    tag: "Təcrübə",
    createdAt: "2026-02-10T07:40:00Z"
  },
  {
    title: "Könüllülük CV-də həqiqətən təsir edirmi?",
    body: "HR baxışında könüllülük layihələri nə qədər önəmlidir? Real nümunə paylaşa bilərsiniz?",
    author: "Nərmin",
    tag: "Könüllülük",
    createdAt: "2026-02-09T17:25:00Z"
  }
];

const replySeedByThreadTitle = {
  "Hakatona komanda tapmaq üçün ən yaxşı yol nədir?": [
    {
      author: "Rauf",
      body: "Mən əvvəlcə forumlarda komanda üzvlərinin texniki stack-i barədə soruşuram, sonra qısa call edirəm.",
      createdAt: "2026-02-10T12:05:00Z"
    },
    {
      author: "Ləman",
      body: "Keçən il Telegram qrupundan tapdığım komanda ilə qatılmışdım. Ən vacibi öhdəlik bölgüsüdür.",
      createdAt: "2026-02-10T13:21:00Z"
    }
  ],
  "Data intern müsahibəsinə necə hazırlaşdınız?": [
    {
      author: "Murad",
      body: "Əvvəl SQL və analitik düşüncə suallarını gücləndir, sonra şirkətə uyğun mini case-lər həll et.",
      createdAt: "2026-02-10T09:02:00Z"
    }
  ],
  "Könüllülük CV-də həqiqətən təsir edirmi?": [
    {
      author: "Səbinə",
      body: "Bəli, xüsusilə nəticə göstəricisi ilə yazanda yaxşı təsir edir. Məsələn, təşkil etdiyin tədbir sayı və iştirakçı sayı.",
      createdAt: "2026-02-09T18:13:00Z"
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

    CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category_key);
    CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline_date);
    CREATE INDEX IF NOT EXISTS idx_threads_created ON threads(created_at);
    CREATE INDEX IF NOT EXISTS idx_replies_thread ON thread_replies(thread_id);
  `);
}

async function seedIfNeeded(db) {
  const { count: opportunityCount } = await db.get(
    "SELECT COUNT(*) as count FROM opportunities"
  );
  if (opportunityCount === 0) {
    const insertOpportunity = await db.prepare(`
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
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of opportunitySeed) {
      await insertOpportunity.run(
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
    await insertOpportunity.finalize();
  }

  const { count: threadCount } = await db.get("SELECT COUNT(*) as count FROM threads");
  if (threadCount === 0) {
    const insertThread = await db.prepare(`
      INSERT INTO threads (
        title,
        body,
        author,
        tag,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const thread of threadSeed) {
      await insertThread.run(
        thread.title,
        thread.body,
        thread.author,
        thread.tag,
        thread.createdAt
      );
    }
    await insertThread.finalize();
  }

  const { count: replyCount } = await db.get("SELECT COUNT(*) as count FROM thread_replies");
  if (replyCount === 0) {
    const insertReply = await db.prepare(`
      INSERT INTO thread_replies (
        thread_id,
        author,
        body,
        created_at
      )
      VALUES (?, ?, ?, ?)
    `);

    const allThreads = await db.all("SELECT id, title FROM threads");
    const threadIdByTitle = new Map(allThreads.map((thread) => [thread.title, thread.id]));

    for (const [title, replies] of Object.entries(replySeedByThreadTitle)) {
      const threadId = threadIdByTitle.get(title);
      if (!threadId) {
        continue;
      }
      for (const reply of replies) {
        await insertReply.run(threadId, reply.author, reply.body, reply.createdAt);
      }
    }
    await insertReply.finalize();
  }
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
    throw new Error("Database initialize olunmayib. Evvelce initializeDatabase() cagrilmalidir.");
  }
  return dbInstance;
}

module.exports = {
  DB_PATH,
  getDatabase,
  initializeDatabase
};
