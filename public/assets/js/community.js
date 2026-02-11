const announcementForm = document.getElementById("announcement-form");
const announcementStatus = document.getElementById("announcement-status");
const announcementList = document.getElementById("announcement-list");

const groupList = document.getElementById("group-list");
const groupForm = document.getElementById("group-form");
const groupStatus = document.getElementById("group-status");

const activeGroupName = document.getElementById("active-group-name");
const activeGroupDescription = document.getElementById("active-group-description");
const messageList = document.getElementById("message-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const messageStatus = document.getElementById("message-status");

let groups = [];
let selectedGroupId = null;
let pollTimer = null;

initCommunity();

async function initCommunity() {
  await waitForAuthUtility();
  await window.KutleWeAuth.refreshUser();

  announcementForm?.addEventListener("submit", handleAnnouncementSubmit);
  groupForm?.addEventListener("submit", handleGroupSubmit);
  messageForm?.addEventListener("submit", handleMessageSubmit);

  await Promise.all([loadAnnouncements(), loadGroups()]);
}

async function loadAnnouncements() {
  if (announcementList) {
    announcementList.innerHTML = `<div class="list-item muted">Yuklenir...</div>`;
  }
  try {
    const response = await fetch("/api/community/announcements", {
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Elanlar yuklenmedi.");
    }
    renderAnnouncements(data.announcements || []);
  } catch (_error) {
    if (announcementList) {
      announcementList.innerHTML = `<div class="list-item muted">Yuklenmedi.</div>`;
    }
  }
}

function renderAnnouncements(items) {
  if (!announcementList) return;
  announcementList.innerHTML = "";
  if (items.length === 0) {
    announcementList.innerHTML = `<div class="list-item muted">Elan yoxdur.</div>`;
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "list-item";
    article.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <div class="meta">
        ${escapeHtml(item.author_name || "Anonim")} |
        ${item.is_approved ? "Tesdiqlenib" : "Gozlemededir"} |
        ${formatDate(item.created_at)}
      </div>
    `;
    announcementList.appendChild(article);
  });
}

async function handleAnnouncementSubmit(event) {
  event.preventDefault();
  const user = await window.KutleWeAuth.refreshUser();
  if (!user) {
    setStatus(announcementStatus, "Elan ucun evvelce login edin.", "error");
    return;
  }

  const formData = new FormData(announcementForm);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    body: String(formData.get("body") || "").trim()
  };

  setStatus(announcementStatus, "Elan gonderilir...", "warn");

  try {
    const response = await fetch("/api/community/announcements", {
      method: "POST",
      headers: window.KutleWeAuth.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Elan gonderilemedi.");
    }
    announcementForm.reset();
    setStatus(
      announcementStatus,
      data.is_approved ? "Elan paylasildi." : "Elan gonderildi, admin tesdiqi gozlenilir.",
      "ok"
    );
    await loadAnnouncements();
  } catch (error) {
    setStatus(announcementStatus, error.message, "error");
  }
}

async function loadGroups() {
  if (groupList) {
    groupList.innerHTML = `<div class="list-item muted">Qruplar yuklenir...</div>`;
  }
  try {
    const response = await fetch("/api/community/groups", {
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Qruplar yuklenmedi.");
    }
    groups = data.groups || [];
    renderGroups();
    if (!selectedGroupId && groups.length > 0) {
      selectGroup(groups[0].id);
    }
  } catch (_error) {
    if (groupList) {
      groupList.innerHTML = `<div class="list-item muted">Qruplar yuklenmedi.</div>`;
    }
  }
}

function renderGroups() {
  if (!groupList) return;
  groupList.innerHTML = "";
  if (groups.length === 0) {
    groupList.innerHTML = `<div class="list-item muted">Qrup yoxdur.</div>`;
    return;
  }

  groups.forEach((group) => {
    const article = document.createElement("article");
    article.className = "list-item";
    article.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem">
        <div>
          <h4 style="margin:0">${escapeHtml(group.name)}</h4>
          <div class="meta">${escapeHtml(group.description || "")}</div>
          <div class="meta">${group.member_count || 0} uzv</div>
        </div>
        <div class="actions">
          <button class="btn btn-outline" data-action="open" data-id="${group.id}">Ac</button>
          <button class="btn btn-outline" data-action="join" data-id="${group.id}">Qosul</button>
        </div>
      </div>
    `;
    groupList.appendChild(article);
  });

  groupList.querySelectorAll("button[data-action='open']").forEach((button) => {
    button.addEventListener("click", () => selectGroup(Number(button.dataset.id)));
  });

  groupList.querySelectorAll("button[data-action='join']").forEach((button) => {
    button.addEventListener("click", async () => {
      await joinGroup(Number(button.dataset.id));
    });
  });
}

async function handleGroupSubmit(event) {
  event.preventDefault();
  const user = await window.KutleWeAuth.refreshUser();
  if (!user) {
    setStatus(groupStatus, "Qrup yaratmaq ucun login edin.", "error");
    return;
  }

  const formData = new FormData(groupForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    is_public: 1
  };

  setStatus(groupStatus, "Qrup yaradilir...", "warn");

  try {
    const response = await fetch("/api/community/groups", {
      method: "POST",
      headers: window.KutleWeAuth.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Qrup yaradilmedi.");
    }
    groupForm.reset();
    setStatus(groupStatus, "Qrup yaradildi.", "ok");
    await loadGroups();
    selectGroup(data.id);
  } catch (error) {
    setStatus(groupStatus, error.message, "error");
  }
}

async function joinGroup(groupId) {
  const user = await window.KutleWeAuth.refreshUser();
  if (!user) {
    setStatus(messageStatus, "Qrupa qosulmaq ucun login edin.", "error");
    return;
  }

  try {
    const response = await fetch(`/api/community/groups/${groupId}/join`, {
      method: "POST",
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Qrupa qosula bilmediniz.");
    }
    setStatus(messageStatus, "Qrupa qosuldunuz.", "ok");
    await loadGroups();
  } catch (error) {
    setStatus(messageStatus, error.message, "error");
  }
}

function selectGroup(groupId) {
  selectedGroupId = Number(groupId);
  const group = groups.find((g) => Number(g.id) === selectedGroupId);
  if (!group) return;
  if (activeGroupName) activeGroupName.textContent = group.name;
  if (activeGroupDescription) activeGroupDescription.textContent = group.description || "Tesvir yoxdur.";
  loadMessages();

  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(loadMessages, 3000);
}

async function loadMessages() {
  if (!selectedGroupId || !messageList) return;
  try {
    const response = await fetch(`/api/community/groups/${selectedGroupId}/messages?limit=80`, {
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Mesajlar yuklenmedi.");
    }
    renderMessages(data.messages || []);
  } catch (_error) {
    messageList.innerHTML = `<div class="muted">Mesajlar yuklenmedi.</div>`;
  }
}

function renderMessages(items) {
  if (!messageList) return;
  messageList.innerHTML = "";
  if (items.length === 0) {
    messageList.innerHTML = `<div class="muted">Hec bir mesaj yoxdur.</div>`;
    return;
  }

  items.forEach((item) => {
    const block = document.createElement("div");
    block.className = "message-item";
    block.innerHTML = `
      <div class="message-author">${escapeHtml(item.user_name || "Anonim")} <span class="meta">| ${formatDate(item.created_at)}</span></div>
      <p class="message-text">${escapeHtml(item.body)}</p>
    `;
    messageList.appendChild(block);
  });
  messageList.scrollTop = messageList.scrollHeight;
}

async function handleMessageSubmit(event) {
  event.preventDefault();
  if (!selectedGroupId) {
    setStatus(messageStatus, "Evvelce qrup secin.", "error");
    return;
  }
  const user = await window.KutleWeAuth.refreshUser();
  if (!user) {
    setStatus(messageStatus, "Mesaj ucun login edin.", "error");
    return;
  }

  const body = String(messageInput?.value || "").trim();
  if (!body) return;

  try {
    const response = await fetch(`/api/community/groups/${selectedGroupId}/messages`, {
      method: "POST",
      headers: window.KutleWeAuth.getAuthHeaders(),
      body: JSON.stringify({ body })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Mesaj gonderilemedi.");
    }
    if (messageInput) messageInput.value = "";
    setStatus(messageStatus, "Mesaj gonderildi.", "ok");
    await loadMessages();
  } catch (error) {
    setStatus(messageStatus, error.message, "error");
  }
}

function setStatus(node, text, tone) {
  if (!node) return;
  node.textContent = text;
  node.className = `status ${tone}`;
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

async function waitForAuthUtility() {
  for (let i = 0; i < 30; i += 1) {
    if (window.KutleWeAuth) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
