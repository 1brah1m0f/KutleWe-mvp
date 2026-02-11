const requestForm = document.getElementById("request-code-form");
const verifyForm = document.getElementById("verify-code-form");
const resetButton = document.getElementById("reset-code-btn");
const requestStatus = document.getElementById("request-status");
const verifyStatus = document.getElementById("verify-status");

const requestNameInput = document.getElementById("request-name");
const requestEmailInput = document.getElementById("request-email");
const verifyNameInput = document.getElementById("verify-name");
const verifyEmailInput = document.getElementById("verify-email");
const verifyCodeInput = document.getElementById("verify-code");

initLogin();

async function initLogin() {
  await waitForAuthUtility();
  const user = await window.KutleWeAuth.refreshUser();
  if (user) {
    window.location.href = "/profile.html";
    return;
  }

  requestForm?.addEventListener("submit", handleRequestCode);
  verifyForm?.addEventListener("submit", handleVerifyCode);
  resetButton?.addEventListener("click", handleResetCode);
}

async function handleRequestCode(event) {
  event.preventDefault();
  setStatus(requestStatus, "Kod gonderilir...", "warn");

  const payload = {
    name: String(requestNameInput?.value || "").trim(),
    email: String(requestEmailInput?.value || "").trim()
  };

  try {
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Kod gonderilemedi.");
    }

    if (verifyEmailInput && !verifyEmailInput.value) {
      verifyEmailInput.value = payload.email;
    }
    if (verifyNameInput && !verifyNameInput.value && payload.name) {
      verifyNameInput.value = payload.name;
    }

    let message = data.message || "Kod gonderildi.";
    if (data.debugCode) {
      message += ` Test kodu: ${data.debugCode}`;
    }
    setStatus(requestStatus, message, "ok");
  } catch (error) {
    setStatus(requestStatus, error.message, "error");
  }
}

async function handleVerifyCode(event) {
  event.preventDefault();
  setStatus(verifyStatus, "Tesdiq olunur...", "warn");

  const payload = {
    name: String(verifyNameInput?.value || "").trim(),
    email: String(verifyEmailInput?.value || "").trim(),
    code: String(verifyCodeInput?.value || "").trim()
  };

  try {
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Kod tesdiq olunmadi.");
    }

    window.KutleWeAuth.setToken(data.token);
    await window.KutleWeAuth.refreshUser();
    setStatus(verifyStatus, "Daxil oldunuz. Yonlendirilir...", "ok");

    setTimeout(() => {
      window.location.href = "/profile.html";
    }, 500);
  } catch (error) {
    setStatus(verifyStatus, error.message, "error");
  }
}

async function handleResetCode() {
  const email = String(verifyEmailInput?.value || requestEmailInput?.value || "").trim();
  const name = String(verifyNameInput?.value || requestNameInput?.value || "").trim();
  if (!email) {
    setStatus(verifyStatus, "Email daxil edin.", "error");
    return;
  }

  setStatus(verifyStatus, "Yeni kod yaradilir...", "warn");

  try {
    const response = await fetch("/api/auth/reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Kod sifirlanmadi.");
    }
    let message = data.message || "Yeni kod gonderildi.";
    if (data.debugCode) {
      message += ` Test kodu: ${data.debugCode}`;
    }
    setStatus(verifyStatus, message, "ok");
  } catch (error) {
    setStatus(verifyStatus, error.message, "error");
  }
}

function setStatus(target, text, tone) {
  if (!target) return;
  target.textContent = text;
  target.className = `status ${tone}`;
}

async function waitForAuthUtility() {
  for (let i = 0; i < 30; i += 1) {
    if (window.KutleWeAuth) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
