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
    setThreadError("Thread ID tapılmadı.");
    if (replyForm) {
      replyForm.style.display = "none";
    }
    return;
  }

  loadThread();

  if (replyForm) {
    replyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitReply();
    });
  }
}

async function loadThread() {
  try {
    const response = await fetch(`/api/forum/threads/${threadId}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || "Thread yüklənmədi.");
    }

    const data = await response.json();
    renderThread(data.thread);
    renderReplies(data.replies || []);
  } catch (error) {
    setThreadError(error.message);
  }
}

function renderThread(thread) {
  if (!thread) {
    setThreadError("Thread məlumatı boşdur.");
    return;
  }

  if (threadTitle) threadTitle.textContent = thread.title;
  if (threadBody) threadBody.textContent = thread.body;
  if (threadMeta) {
    threadMeta.textContent = `${thread.author} | ${
      thread.tag || "Tag yoxdur"
    } | ${formatDateTime(thread.created_at)}`;
  }
}

function renderReplies(replies) {
  if (!replyList) return;

  if (replies.length === 0) {
    replyList.innerHTML = `<div class="empty-box">Hələ cavab yoxdur. İlk cavabı siz yazın.</div>`;
    return;
  }

  replyList.innerHTML = "";

  replies.forEach((reply) => {
    const card = document.createElement("article");
    card.className = "reply-card";

    const meta = document.createElement("div");
    meta.className = "thread-meta";
    meta.textContent = `${reply.author} | ${formatDateTime(reply.created_at)}`;

    const body = document.createElement("p");
    body.textContent = reply.body;

    card.appendChild(meta);
    card.appendChild(body);
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

  replyStatus.textContent = "Göndərilir...";
  replyStatus.className = "status-message";

  try {
    const response = await fetch(`/api/forum/threads/${threadId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Cavab göndərilə bilmədi.");
    }

    replyStatus.textContent = "Cavab əlavə olundu.";
    replyStatus.className = "status-message success";
    replyForm.reset();
    await loadThread();
  } catch (error) {
    replyStatus.textContent = error.message;
    replyStatus.className = "status-message error";
  }
}

function setThreadError(message) {
  if (threadTitle) threadTitle.textContent = "Xəta";
  if (threadBody) threadBody.textContent = message;
  if (threadMeta) threadMeta.textContent = "";
  if (replyList) replyList.innerHTML = `<div class="empty-box">${message}</div>`;
}

function getThreadIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
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
