const adminLoginForm = document.getElementById("admin-login-form");
const adminStatus = document.getElementById("admin-status");
const adminAccountStatus = document.getElementById("admin-account-status");
const adminAnnouncements = document.getElementById("admin-announcements");

initAdmin();

async function initAdmin() {
  await waitForAuthUtility();
  const user = await window.KutleWeAuth.refreshUser();
  updateAccountStatus(user);

  adminLoginForm?.addEventListener("submit", handleAdminLogin);

  if (user?.is_admin) {
    await loadAnnouncementsForAdmin();
  } else {
    renderLoginRequired();
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  setStatus("Admin girisi yoxlanilir...", "warn");

  const email = "admin@local";
  const accessCode = "dev";
  try {
    const response = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, accessCode })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Admin girisi ugursuz oldu.");
    }

    window.KutleWeAuth.setToken(data.token);
    const user = await window.KutleWeAuth.refreshUser();
    updateAccountStatus(user);
    setStatus("Admin girisi ugurla tamamlandi.", "ok");
    await loadAnnouncementsForAdmin();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadAnnouncementsForAdmin() {
  if (!adminAnnouncements) return;
  adminAnnouncements.innerHTML = `<div class="list-item muted">Yuklenir...</div>`;

  try {
    const response = await fetch("/api/community/announcements", {
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Elanlar yuklenmedi.");
    }
    renderAdminAnnouncements(data.announcements || []);
  } catch (_error) {
    adminAnnouncements.innerHTML = `<div class="list-item muted">Yuklenmedi.</div>`;
  }
}

function renderAdminAnnouncements(items) {
  if (!adminAnnouncements) return;
  adminAnnouncements.innerHTML = "";
  if (items.length === 0) {
    adminAnnouncements.innerHTML = `<div class="list-item muted">Elan yoxdur.</div>`;
    return;
  }

  items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "list-item";
    block.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <div class="meta">${escapeHtml(item.author_name || "Anonim")} | ${item.is_approved ? "Tesdiqlenib" : "Gozlemededir"}</div>
      <div class="actions" style="margin-top:0.5rem">
        <button class="btn btn-primary" data-id="${item.id}" data-approve="1">Tesdiq et</button>
        <button class="btn btn-outline" data-id="${item.id}" data-approve="0">Legv et</button>
      </div>
    `;
    adminAnnouncements.appendChild(block);
  });

  adminAnnouncements.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await approveAnnouncement(Number(button.dataset.id), Number(button.dataset.approve));
    });
  });
}

async function approveAnnouncement(id, approved) {
  try {
    const response = await fetch(`/api/community/announcements/${id}/approve`, {
      method: "PATCH",
      headers: window.KutleWeAuth.getAuthHeaders(),
      body: JSON.stringify({ approved })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Emeliyyat ugursuz oldu.");
    }
    await loadAnnouncementsForAdmin();
    setStatus("Elan statusu yenilendi.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function updateAccountStatus(user) {
  if (!adminAccountStatus) return;
  if (!user) {
    adminAccountStatus.textContent = "Daxil olmayib";
    return;
  }
  if (!user.is_admin) {
    adminAccountStatus.textContent = `${user.email} (admin deyil)`;
    return;
  }
  adminAccountStatus.textContent = `${user.email} (admin)`;
}

function renderLoginRequired() {
  if (!adminAnnouncements) return;
  adminAnnouncements.innerHTML = `<div class="list-item muted">Paneli gormek ucun admin kimi daxil olun.</div>`;
}

function setStatus(text, tone) {
  if (!adminStatus) return;
  adminStatus.textContent = text;
  adminStatus.className = `status ${tone}`;
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
