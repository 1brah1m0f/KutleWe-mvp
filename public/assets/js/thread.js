const threadTitle = document.getElementById("thread-title");
const threadBody = document.getElementById("thread-body");
const threadMeta = document.getElementById("thread-meta");
const replyList = document.getElementById("reply-list");
const replyForm = document.getElementById("reply-form");
const replyStatus = document.getElementById("reply-status");

const threadId = getThreadIdFromQuery();

initializeThreadPage();

function initializeThreadPage() {
  if (!threadId) {
    setThreadError("Thread ID tapilmadi.");
    replyForm && (replyForm.style.display = "none");
    return;
  }

  loadThread();
  replyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitReply();
  });
}

async function loadThread() {
  try {
    const response = await fetch(`/api/forum/threads/${threadId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Thread yuklenmedi.");
    }

    renderThread(data.thread);
    renderReplies(data.replies || []);
  } catch (error) {
    setThreadError(error.message);
  }
}

function renderThread(thread) {
  if (!thread) {
    setThreadError("Thread melumati yoxdur.");
    return;
  }
  if (threadTitle) threadTitle.textContent = thread.title;
  if (threadBody) threadBody.textContent = thread.body;
  if (threadMeta) {
    threadMeta.textContent = `${thread.author} | ${thread.tag || "Tag yoxdur"} | ${formatDate(thread.created_at)}`;
  }
}

function renderReplies(replies) {
  if (!replyList) return;
  replyList.innerHTML = "";
  if (replies.length === 0) {
    replyList.innerHTML = `<div class="list-item muted">Hele cavab yoxdur.</div>`;
    return;
  }

  replies.forEach((reply) => {
    const card = document.createElement("article");
    card.className = "list-item";
    card.innerHTML = `
      <div class="meta">${escapeHtml(reply.author)} | ${formatDate(reply.created_at)}</div>
      <p>${escapeHtml(reply.body)}</p>
    `;
    replyList.appendChild(card);
  });
}

async function submitReply() {
  if (!replyForm || !replyStatus || !threadId) return;

  const formData = new FormData(replyForm);
  const payload = {
    author: String(formData.get("author") || "").trim(),
    body: String(formData.get("body") || "").trim()
  };

  setStatus("Gonderilir...", "warn");
  try {
    const response = await fetch(`/api/forum/threads/${threadId}/replies`, {
      method: "POST",
      headers: window.KutleWeAuth ? window.KutleWeAuth.getAuthHeaders() : { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Cavab gonderilemedi.");
    }
    replyForm.reset();
    setStatus("Cavab elave olundu.", "ok");
    await loadThread();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function setThreadError(message) {
  if (threadTitle) threadTitle.textContent = "Xeta";
  if (threadBody) threadBody.textContent = message;
  if (threadMeta) threadMeta.textContent = "";
  if (replyList) replyList.innerHTML = `<div class="list-item muted">${message}</div>`;
}

function getThreadIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function setStatus(text, tone) {
  if (!replyStatus) return;
  replyStatus.textContent = text;
  replyStatus.className = `status ${tone}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
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
