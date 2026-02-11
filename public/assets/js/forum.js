const threadList = document.getElementById("thread-list");
const threadMeta = document.getElementById("thread-meta");
const threadForm = document.getElementById("thread-form");
const threadStatus = document.getElementById("thread-status");

initializeForumPage();

function initializeForumPage() {
  loadThreads();
  threadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createThread();
  });
}

async function loadThreads() {
  if (threadMeta) threadMeta.textContent = "Yuklenir...";
  try {
    const response = await fetch("/api/forum/threads");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Yuklenmedi.");
    }
    renderThreads(data.threads || []);
    if (threadMeta) threadMeta.textContent = `${data.total || 0} movzu`;
  } catch (_error) {
    if (threadList) {
      threadList.innerHTML = `<div class="list-item muted">Movzular yuklenmedi.</div>`;
    }
  }
}

function renderThreads(threads) {
  if (!threadList) return;
  threadList.innerHTML = "";
  if (threads.length === 0) {
    threadList.innerHTML = `<div class="list-item muted">Movzu yoxdur.</div>`;
    return;
  }

  threads.forEach((thread) => {
    const card = document.createElement("article");
    card.className = "list-item";
    card.innerHTML = `
      <h3><a href="/thread.html?id=${thread.id}">${escapeHtml(thread.title)}</a></h3>
      <p>${escapeHtml(shorten(thread.body, 180))}</p>
      <div class="meta">${escapeHtml(thread.author)} | ${thread.reply_count || 0} cavab | ${
      thread.tag ? escapeHtml(thread.tag) : "Tag yoxdur"
    }</div>
    `;
    threadList.appendChild(card);
  });
}

async function createThread() {
  if (!threadForm || !threadStatus) return;
  const formData = new FormData(threadForm);
  const payload = {
    author: String(formData.get("author") || "").trim(),
    tag: String(formData.get("tag") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    body: String(formData.get("body") || "").trim()
  };

  setStatus("Gonderilir...", "warn");
  try {
    const response = await fetch("/api/forum/threads", {
      method: "POST",
      headers: window.KutleWeAuth ? window.KutleWeAuth.getAuthHeaders() : { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Thread yaradilmedi.");
    }
    threadForm.reset();
    setStatus("Thread yaradildi.", "ok");
    await loadThreads();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function setStatus(text, tone) {
  if (!threadStatus) return;
  threadStatus.textContent = text;
  threadStatus.className = `status ${tone}`;
}

function shorten(text, maxLen) {
  const value = String(text || "");
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
