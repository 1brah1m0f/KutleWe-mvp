const CATEGORY_KEYS = new Set([
  "all",
  "internship",
  "volunteering",
  "hackathon",
  "career"
]);
const MODE_VALUES = new Set(["all", "Onsite", "Hibrid", "Remote"]);

const AZ_TO_ASCII = {
  ə: "e",
  Ə: "e",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ü: "u",
  Ü: "u",
  ş: "s",
  Ş: "s",
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g"
};

const STOP_WORDS = new Set([
  "ve",
  "ya",
  "ile",
  "ucun",
  "ucun",
  "de",
  "da",
  "bu",
  "bir",
  "kimi",
  "en",
  "cox",
  "daha",
  "nə",
  "ne"
]);

const categoryAliases = [
  { key: "internship", words: ["tecrube", "intern", "internship", "staj"] },
  { key: "volunteering", words: ["konullu", "volunteer", "volunteering"] },
  { key: "hackathon", words: ["hakaton", "hackathon", "hack"] },
  { key: "career", words: ["karyera", "career", "networking", "tedbir", "event"] }
];

const modeAliases = [
  { value: "Remote", words: ["remote", "onlayn", "online"] },
  { value: "Hibrid", words: ["hibrid", "hybrid"] },
  { value: "Onsite", words: ["onsite", "fiziki", "ofisde"] }
];

const locationAliases = [
  { value: "Bakı", words: ["baki", "baku"] },
  { value: "Gəncə", words: ["gence", "ganja"] },
  { value: "Quba", words: ["quba"] },
  { value: "Sumqayıt", words: ["sumqayit", "sumgait"] },
  { value: "Şəki", words: ["seki", "sheki"] }
];

const monthMap = {
  yanvar: 0,
  fevral: 1,
  mart: 2,
  aprel: 3,
  may: 4,
  iyun: 5,
  iyul: 6,
  avqust: 7,
  sentyabr: 8,
  oktyabr: 9,
  noyabr: 10,
  dekabr: 11
};

function normalizeAzeri(text) {
  if (text == null) {
    return "";
  }

  return String(text)
    .replace(/[ƏəIİıÖöÜüŞşÇçĞğ]/g, (char) => AZ_TO_ASCII[char] || char)
    .toLowerCase();
}

function cleanString(value, maxLength = 150) {
  const cleaned = String(value || "").trim();
  return cleaned.slice(0, maxLength);
}

function sanitizeDate(dateValue) {
  const value = cleanString(dateValue, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }
  return value;
}

function extractKeywords(text) {
  const normalized = normalizeAzeri(text);
  const parts = normalized
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return [...new Set(parts)].slice(0, 8);
}

function sanitizeKeywordList(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const keywords = input
    .map((item) => cleanString(item, 30))
    .filter(Boolean)
    .flatMap((item) => extractKeywords(item));

  return [...new Set(keywords)].slice(0, 8);
}

function normalizeFilters(rawFilters = {}) {
  const categoryKey = cleanString(rawFilters.categoryKey || "all", 20);
  const mode = cleanString(rawFilters.mode || "all", 20);
  const location = cleanString(rawFilters.location || "", 50);
  const search = cleanString(rawFilters.search || "", 120);
  const deadlineBefore = sanitizeDate(rawFilters.deadlineBefore || "");

  return {
    categoryKey: CATEGORY_KEYS.has(categoryKey) ? categoryKey : "all",
    mode: MODE_VALUES.has(mode) ? mode : "all",
    location,
    search,
    deadlineBefore,
    keywords: sanitizeKeywordList(rawFilters.keywords)
  };
}

function mergeFilters(baseFilters, aiFilters) {
  const normalizedBase = normalizeFilters(baseFilters);

  if (!aiFilters || typeof aiFilters !== "object") {
    return normalizedBase;
  }

  const candidate = {
    ...normalizedBase,
    categoryKey: aiFilters.categoryKey || normalizedBase.categoryKey,
    mode: aiFilters.mode || normalizedBase.mode,
    location: aiFilters.location || normalizedBase.location,
    search: aiFilters.search || normalizedBase.search,
    deadlineBefore: aiFilters.deadlineBefore || normalizedBase.deadlineBefore,
    keywords: [
      ...(normalizedBase.keywords || []),
      ...(sanitizeKeywordList(aiFilters.keywords) || [])
    ]
  };

  return normalizeFilters(candidate);
}

function detectByAliases(normalizedPrompt, aliases, emptyValue = "") {
  for (const entry of aliases) {
    if (entry.words.some((word) => normalizedPrompt.includes(word))) {
      return entry.key || entry.value || emptyValue;
    }
  }
  return emptyValue;
}

function detectDeadlineFromPrompt(normalizedPrompt) {
  if (normalizedPrompt.includes("bu ay")) {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return endOfMonth.toISOString().slice(0, 10);
  }

  if (
    normalizedPrompt.includes("tez") ||
    normalizedPrompt.includes("yaxin") ||
    normalizedPrompt.includes("erken")
  ) {
    const now = new Date();
    const plusThirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return plusThirty.toISOString().slice(0, 10);
  }

  const match = normalizedPrompt.match(
    /(\d{1,2})\s+(yanvar|fevral|mart|aprel|may|iyun|iyul|avqust|sentyabr|oktyabr|noyabr|dekabr)/
  );

  if (!match) {
    return "";
  }

  const day = Number(match[1]);
  const month = monthMap[match[2]];
  if (Number.isNaN(day) || month === undefined) {
    return "";
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getTime() < now.getTime()) {
    year += 1;
  }
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function ruleBasedOpportunityIntent(promptText) {
  const rawPrompt = cleanString(promptText, 280);
  const normalizedPrompt = normalizeAzeri(rawPrompt);

  const categoryKey = detectByAliases(normalizedPrompt, categoryAliases, "");
  const mode = detectByAliases(normalizedPrompt, modeAliases, "");
  const location = detectByAliases(normalizedPrompt, locationAliases, "");
  const deadlineBefore = detectDeadlineFromPrompt(normalizedPrompt);
  const keywords = extractKeywords(rawPrompt);

  const reasons = [];
  if (categoryKey) {
    reasons.push(`kateqoriya: ${categoryKey}`);
  }
  if (mode) {
    reasons.push(`format: ${mode}`);
  }
  if (location) {
    reasons.push(`məkan: ${location}`);
  }
  if (deadlineBefore) {
    reasons.push(`son tarix: ${deadlineBefore}`);
  }
  if (keywords.length > 0) {
    reasons.push(`açar sözlər: ${keywords.join(", ")}`);
  }

  return {
    filters: {
      categoryKey,
      mode,
      location,
      deadlineBefore,
      keywords
    },
    reason:
      reasons.length > 0
        ? `AI filtr məntiqi bu ipucları ilə quruldu: ${reasons.join(" | ")}`
        : "AI filtr üçün açar ipucu tapılmadı, standart filtr tətbiq edildi."
  };
}

module.exports = {
  normalizeAzeri,
  normalizeFilters,
  mergeFilters,
  ruleBasedOpportunityIntent,
  extractKeywords
};
