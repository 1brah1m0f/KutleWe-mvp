const profileName = document.getElementById("profile-name");
const profileHeadline = document.getElementById("profile-headline");
const profileLocation = document.getElementById("profile-location");
const profileAbout = document.getElementById("profile-about");
const profileSkills = document.getElementById("profile-skills");
const profileAvatar = document.getElementById("profile-avatar");

const editCard = document.getElementById("edit-card");
const activityCard = document.getElementById("activity-card");
const profileForm = document.getElementById("profile-form");
const profileStatus = document.getElementById("profile-status");

const myAnnouncements = document.getElementById("my-announcements");
const myThreads = document.getElementById("my-threads");

let activeUser = null;
let viewingUserId = null;

initProfile();

async function initProfile() {
  await waitForAuthUtility();
  const queryId = getQueryId();
  const me = await window.KutleWeAuth.refreshUser();

  if (!queryId) {
    if (!me) {
      window.location.href = "/login.html";
      return;
    }
    activeUser = me;
    viewingUserId = me.id;
    renderProfile(me);
    fillForm(me);
    bindForm();
    await loadMyActivity(me);
    return;
  }

  const userData = await fetchPublicProfile(queryId);
  if (!userData) return;
  activeUser = userData;
  viewingUserId = userData.id;
  renderProfile(userData);

  if (!me || me.id !== userData.id) {
    if (editCard) editCard.hidden = true;
    if (activityCard) activityCard.hidden = true;
  } else {
    fillForm(me);
    bindForm();
    await loadMyActivity(me);
  }
}

function bindForm() {
  if (!profileForm) return;
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile();
  });
}

async function saveProfile() {
  if (!profileForm) return;
  setStatus("Yaddasda saxlanir...", "warn");

  const formData = new FormData(profileForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    headline: String(formData.get("headline") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    about: String(formData.get("about") || "").trim(),
    skills: String(formData.get("skills") || "").trim(),
    linkedin_url: String(formData.get("linkedin_url") || "").trim(),
    avatar_url: String(formData.get("avatar_url") || "").trim()
  };

  try {
    const response = await fetch("/api/profile/me", {
      method: "PUT",
      headers: window.KutleWeAuth.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Profil yenilenmedi.");
    }
    activeUser = data.user;
    renderProfile(activeUser);
    fillForm(activeUser);
    await window.KutleWeAuth.refreshUser();
    setStatus("Profil ugurla yenilendi.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function fetchPublicProfile(userId) {
  try {
    const response = await fetch(`/api/profile/${userId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Profil tapilmadi.");
    }
    return {
      ...data.user,
      skills: Array.isArray(data.user.skills) ? data.user.skills.join(", ") : ""
    };
  } catch (error) {
    if (profileAbout) profileAbout.textContent = error.message;
    return null;
  }
}

function fillForm(user) {
  if (!profileForm || !user) return;
  profileForm.name.value = user.name || "";
  profileForm.headline.value = user.headline || "";
  profileForm.location.value = user.location || "";
  profileForm.about.value = user.about || "";
  profileForm.skills.value = Array.isArray(user.skills) ? user.skills.join(", ") : user.skills || "";
  profileForm.linkedin_url.value = user.linkedin_url || "";
  profileForm.avatar_url.value = user.avatar_url || "";
}

function renderProfile(user) {
  if (!user) return;

  const name = user.name || "Istifadeci";
  const headline = user.headline || "Headline yoxdur";
  const location = user.location || "Mekan qeyd edilmeyib";
  const about = user.about || "About hissesi bosdur.";
  const avatar = user.avatar_url || "https://via.placeholder.com/120x120.png?text=Profile";

  if (profileName) profileName.textContent = name;
  if (profileHeadline) profileHeadline.textContent = headline;
  if (profileLocation) profileLocation.textContent = location;
  if (profileAbout) profileAbout.textContent = about;
  if (profileAvatar) {
    profileAvatar.src = avatar;
    profileAvatar.onerror = () => {
      profileAvatar.src = "https://via.placeholder.com/120x120.png?text=Profile";
    };
  }

  const skills = Array.isArray(user.skills)
    ? user.skills
    : String(user.skills || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  if (profileSkills) {
    profileSkills.innerHTML = "";
    if (skills.length === 0) {
      profileSkills.innerHTML = `<span class="meta">Skill yoxdur</span>`;
    } else {
      skills.forEach((skill) => {
        const tag = document.createElement("span");
        tag.className = "badge";
        tag.textContent = skill;
        profileSkills.appendChild(tag);
      });
    }
  }
}

async function loadMyActivity(me) {
  await Promise.all([loadMyAnnouncements(me.id), loadMyThreads(me.name)]);
}

async function loadMyAnnouncements(myId) {
  if (!myAnnouncements) return;
  myAnnouncements.innerHTML = `<div class="list-item muted">Yuklenir...</div>`;
  try {
    const response = await fetch("/api/community/announcements", {
      headers: window.KutleWeAuth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Elanlar yuklenmedi.");
    }
    const mine = (data.announcements || []).filter((item) => Number(item.author_id) === Number(myId));
    renderSimpleList(myAnnouncements, mine, (item) => `
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body)}</p>
      <div class="meta">${item.is_approved ? "Tesdiqlenib" : "Gozlemededir"}</div>
    `);
  } catch (_error) {
    myAnnouncements.innerHTML = `<div class="list-item muted">Yuklenmedi.</div>`;
  }
}

async function loadMyThreads(myName) {
  if (!myThreads) return;
  myThreads.innerHTML = `<div class="list-item muted">Yuklenir...</div>`;
  try {
    const response = await fetch("/api/forum/threads");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Threadler yuklenmedi.");
    }
    const mine = (data.threads || []).filter((item) => String(item.author || "") === String(myName || ""));
    renderSimpleList(myThreads, mine, (item) => `
      <h4><a href="/thread.html?id=${item.id}">${escapeHtml(item.title)}</a></h4>
      <div class="meta">${item.reply_count || 0} cavab</div>
    `);
  } catch (_error) {
    myThreads.innerHTML = `<div class="list-item muted">Yuklenmedi.</div>`;
  }
}

function renderSimpleList(container, items, template) {
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `<div class="list-item muted">Melumat yoxdur.</div>`;
    return;
  }
  items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "list-item";
    block.innerHTML = template(item);
    container.appendChild(block);
  });
}

function setStatus(text, tone) {
  if (!profileStatus) return;
  profileStatus.textContent = text;
  profileStatus.className = `status ${tone}`;
}

function getQueryId() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("id"));
  if (!value || !Number.isInteger(value) || value <= 0) return null;
  return value;
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
