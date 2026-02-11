const countUsers = document.getElementById("count-users");
const countOpportunities = document.getElementById("count-opportunities");
const countThreads = document.getElementById("count-threads");
const countAnnouncements = document.getElementById("count-announcements");
const announcementBox = document.getElementById("home-announcements");
const threadBox = document.getElementById("home-threads");

initHome();

async function initHome() {
  try {
    const response = await fetch("/api/summary");
    if (!response.ok) {
      throw new Error("Summary xetasi");
    }
    const data = await response.json();
    renderCounts(data.counts || {});
    renderAnnouncements(data.latestAnnouncements || []);
    renderThreads(data.latestThreads || []);
  } catch (_error) {
    renderError();
  }
}

function renderCounts(counts) {
  if (countUsers) countUsers.textContent = String(counts.users || 0);
  if (countOpportunities) countOpportunities.textContent = String(counts.opportunities || 0);
  if (countThreads) countThreads.textContent = String(counts.threads || 0);
  if (countAnnouncements) countAnnouncements.textContent = String(counts.announcements || 0);
}

function renderAnnouncements(items) {
  if (!announcementBox) return;
  if (items.length === 0) {
    announcementBox.innerHTML = `<div class="list-item muted">Hec bir elan yoxdur.</div>`;
    return;
  }

  announcementBox.innerHTML = "";
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "list-item";
    article.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <div class="meta">${escapeHtml(item.author_name || "Anonim")} | ${formatDate(item.created_at)}</div>
    `;
    announcementBox.appendChild(article);
  });
}

function renderThreads(items) {
  if (!threadBox) return;
  if (items.length === 0) {
    threadBox.innerHTML = `<div class="list-item muted">Hec bir movzu yoxdur.</div>`;
    return;
  }

  threadBox.innerHTML = "";
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "list-item";
    article.innerHTML = `
      <h3><a href="/thread.html?id=${item.id}">${escapeHtml(item.title)}</a></h3>
      <div class="meta">${escapeHtml(item.author || "Anonim")} | ${item.reply_count || 0} cavab</div>
    `;
    threadBox.appendChild(article);
  });
}

function renderError() {
  if (announcementBox) {
    announcementBox.innerHTML = `<div class="list-item muted">Melumat yuklenmedi.</div>`;
  }
  if (threadBox) {
    threadBox.innerHTML = `<div class="list-item muted">Melumat yuklenmedi.</div>`;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
