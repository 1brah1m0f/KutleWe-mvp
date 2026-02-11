const STORAGE_KEY = "kutlewe_token";

const authState = {
  user: null,
  token: localStorage.getItem(STORAGE_KEY) || ""
};

window.KutleWeAuth = {
  clearToken,
  getAuthHeaders,
  getCurrentUser: () => authState.user,
  getToken: () => authState.token,
  logout,
  refreshUser,
  setToken
};

bootstrap();

async function bootstrap() {
  markActiveMenu();
  await refreshUser();
  renderAuthState();
  bindAuthActions();
}

function setToken(token) {
  authState.token = String(token || "").trim();
  if (authState.token) {
    localStorage.setItem(STORAGE_KEY, authState.token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearToken() {
  setToken("");
  authState.user = null;
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }
  return headers;
}

function markActiveMenu() {
  const normalizedPath =
    window.location.pathname === "/" ? "/index.html" : window.location.pathname;
  const links = document.querySelectorAll("a[data-nav]");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href === normalizedPath) {
      link.classList.add("active");
    }
  });
}

function renderAuthState() {
  const guestElements = document.querySelectorAll('[data-auth="guest"]');
  const userElements = document.querySelectorAll('[data-auth="user"]');
  const userNameElements = document.querySelectorAll("[data-user-name]");
  const isLoggedIn = Boolean(authState.user);

  guestElements.forEach((element) => {
    element.hidden = isLoggedIn;
  });
  userElements.forEach((element) => {
    element.hidden = !isLoggedIn;
  });
  userNameElements.forEach((element) => {
    element.textContent = isLoggedIn ? authState.user.name || authState.user.email : "";
  });
}

async function refreshUser() {
  if (!authState.token) {
    authState.user = null;
    renderAuthState();
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      clearToken();
      renderAuthState();
      return null;
    }

    const payload = await response.json();
    authState.user = payload.user || null;
    renderAuthState();
    return authState.user;
  } catch (_error) {
    return null;
  }
}

async function logout() {
  try {
    if (authState.token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders()
      });
    }
  } catch (_error) {
    // ignore logout errors
  } finally {
    clearToken();
    renderAuthState();
  }
}

function bindAuthActions() {
  const logoutButtons = document.querySelectorAll("[data-action='logout']");
  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await logout();
      if (window.location.pathname !== "/index.html" && window.location.pathname !== "/") {
        window.location.href = "/index.html";
      }
    });
  });
}
