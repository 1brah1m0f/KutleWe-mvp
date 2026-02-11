const { extractKeywords, normalizeAzeri } = require("./filter-service");

function buildBaseQuery(filters) {
  const queryParts = ["SELECT * FROM opportunities WHERE 1 = 1"];
  const params = [];

  if (filters.categoryKey && filters.categoryKey !== "all") {
    queryParts.push("AND category_key = ?");
    params.push(filters.categoryKey);
  }

  if (filters.mode && filters.mode !== "all") {
    queryParts.push("AND mode = ?");
    params.push(filters.mode);
  }

  if (filters.location) {
    queryParts.push("AND LOWER(location) LIKE LOWER(?)");
    params.push(`%${filters.location}%`);
  }

  if (filters.deadlineBefore) {
    queryParts.push("AND date(deadline_date) <= date(?)");
    params.push(filters.deadlineBefore);
  }

  queryParts.push("ORDER BY date(deadline_date) ASC, datetime(created_at) DESC");
  return { sql: queryParts.join(" "), params };
}

function scoreByKeywords(items, filters) {
  const searchKeywords = extractKeywords(filters.search || "");
  const allKeywords = [...new Set([...(filters.keywords || []), ...searchKeywords])];

  if (allKeywords.length === 0) {
    return items;
  }

  const withScore = items
    .map((item) => {
      const haystack = normalizeAzeri(
        [
          item.title,
          item.organization,
          item.category_label,
          item.location,
          item.mode,
          item.description
        ].join(" ")
      );

      const score = allKeywords.reduce((acc, token) => {
        if (haystack.includes(normalizeAzeri(token))) {
          return acc + 1;
        }
        return acc;
      }, 0);

      return { item, score };
    })
    .filter((entry) => entry.score > 0);

  withScore.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const deadlineA = new Date(a.item.deadline_date).getTime();
    const deadlineB = new Date(b.item.deadline_date).getTime();
    return deadlineA - deadlineB;
  });

  return withScore.map((entry) => entry.item);
}

async function listOpportunities(db, filters) {
  const { sql, params } = buildBaseQuery(filters);
  const rows = await db.all(sql, params);
  return scoreByKeywords(rows, filters);
}

async function getOpportunityById(db, id) {
  return db.get("SELECT * FROM opportunities WHERE id = ?", [id]);
}

module.exports = {
  getOpportunityById,
  listOpportunities
};
