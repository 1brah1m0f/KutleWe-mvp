const opportunityFeed = document.getElementById("home-opportunities");
const threadFeed = document.getElementById("home-threads");

const countOpportunities = document.getElementById("count-opportunities");
const countThreads = document.getElementById("count-threads");
const countReplies = document.getElementById("count-replies");

initializeHome();

async function initializeHome() {
  try {
    const response = await fetch("/api/summary");
    if (!response.ok) {
      throw new Error("Summary endpoint xətası");
    }
    const data = await response.json();
    renderSummary(data);
  } catch (_error) {
    renderHomeError();
  }
}

function renderSummary(data) {
  if (countOpportunities) countOpportunities.textContent = String(data?.counts?.opportunities || 0);
  if (countThreads) countThreads.textContent = String(data?.counts?.threads || 0);
  if (countReplies) countReplies.textContent = String(data?.counts?.replies || 0);

  renderOpportunityFeed(data?.latestOpportunities || []);
  renderThreadFeed(data?.latestThreads || []);
}

function renderOpportunityFeed(items) {
  if (!opportunityFeed) return;

  if (items.length === 0) {
    opportunityFeed.innerHTML = `<div class="empty-box">Hələ fürsət yoxdur.</div>`;
    return;
  }

  opportunityFeed.innerHTML = "";
  items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "mini-item";

    const title = document.createElement("h4");
    title.textContent = item.title;

    const info = document.createElement("p");
    info.textContent = `${item.category_label} | Son tarix: ${formatDate(item.deadline_date)}`;

    block.appendChild(title);
    block.appendChild(info);
    opportunityFeed.appendChild(block);
  });
}

function renderThreadFeed(items) {
  if (!threadFeed) return;

  if (items.length === 0) {
    threadFeed.innerHTML = `<div class="empty-box">Hələ forum mövzusu yoxdur.</div>`;
    return;
  }

  threadFeed.innerHTML = "";
  items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "mini-item";

    const title = document.createElement("h4");
    const anchor = document.createElement("a");
    anchor.href = `/thread.html?id=${item.id}`;
    anchor.textContent = item.title;
    anchor.style.color = "var(--text)";
    anchor.style.textDecoration = "none";
    title.appendChild(anchor);

    const info = document.createElement("p");
    info.textContent = `${item.author} | ${item.reply_count} cavab`;

    block.appendChild(title);
    block.appendChild(info);
    threadFeed.appendChild(block);
  });
}

function renderHomeError() {
  if (opportunityFeed) {
    opportunityFeed.innerHTML = `<div class="empty-box">Məlumat yüklənmədi.</div>`;
  }
  if (threadFeed) {
    threadFeed.innerHTML = `<div class="empty-box">Məlumat yüklənmədi.</div>`;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long" }).format(date);
}
