const threadList = document.getElementById("thread-list");
const threadMeta = document.getElementById("thread-meta");
const threadForm = document.getElementById("thread-form");
const threadStatus = document.getElementById("thread-status");

initializeForumPage();

function initializeForumPage() {
  loadThreads();

  if (threadForm) {
    threadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await createThread();
    });
  }
}

async function loadThreads() {
  if (threadMeta) {
    threadMeta.textContent = "Yüklənir...";
  }

  try {
    const response = await fetch("/api/forum/threads");
    if (!response.ok) {
      throw new Error("Thread list endpoint xətası");
    }

    const data = await response.json();
    renderThreads(data.threads || []);
    if (threadMeta) {
      threadMeta.textContent = `${data.total || 0} mövzu`;
    }
  } catch (_error) {
    if (threadList) {
      threadList.innerHTML = `<div class="empty-box">Mövzular yüklənmədi.</div>`;
    }
    if (threadMeta) {
      threadMeta.textContent = "Xəta baş verdi";
    }
  }
}

function renderThreads(threads) {
  if (!threadList) return;

  if (threads.length === 0) {
    threadList.innerHTML = `<div class="empty-box">Hələ mövzu yoxdur.</div>`;
    return;
  }

  threadList.innerHTML = "";

  threads.forEach((thread) => {
    const card = document.createElement("article");
    card.className = "thread-card";

    const title = document.createElement("h3");
    title.innerHTML = `<a href="/thread.html?id=${thread.id}">${escapeHtml(thread.title)}</a>`;

    const body = document.createElement("p");
    body.textContent = truncate(thread.body, 170);

    const meta = document.createElement("div");
    meta.className = "thread-meta";
    meta.innerHTML = `
      <span>${escapeHtml(thread.author)}</span>
      <span>${thread.reply_count} cavab</span>
      <span>${thread.tag ? escapeHtml(thread.tag) : "Tag yoxdur"}</span>
      <span>Son aktivlik: ${formatDateTime(thread.last_activity)}</span>
    `;

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(meta);
    threadList.appendChild(card);
  });
}

async function createThread() {
  if (!threadForm || !threadStatus) return;

  const formData = new FormData(threadForm);
  const payload = {
    author: String(formData.get("author") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    body: String(formData.get("body") || "").trim(),
    tag: String(formData.get("tag") || "").trim()
  };

  threadStatus.textContent = "Göndərilir...";
  threadStatus.className = "status-message";

  try {
    const response = await fetch("/api/forum/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Thread yaradıla bilmədi");
    }

    threadStatus.textContent = "Thread uğurla yaradıldı.";
    threadStatus.className = "status-message success";
    threadForm.reset();
    await loadThreads();
  } catch (error) {
    threadStatus.textContent = error.message;
    threadStatus.className = "status-message error";
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  return `${text.slice(0, maxLength)}...`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
