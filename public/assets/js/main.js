const healthNode = document.getElementById("health-status");
const dbNode = document.getElementById("db-status");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");
const chatError = document.getElementById("chat-error");
const quickPromptButtons = document.querySelectorAll("[data-prompt]");

init();

function init() {
  checkHealth();
  checkDb();
  setupChat();
}

async function checkHealth() {
  if (!healthNode) return;
  try {
    const response = await fetch("/health");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data?.message || "Health endpoint error");
    }
    healthNode.textContent = "Server aktivdir";
    healthNode.className = "status ok";
  } catch (error) {
    healthNode.textContent = `Xəta: ${error.message}`;
    healthNode.className = "status error";
  }
}

async function checkDb() {
  if (!dbNode) return;
  try {
    const response = await fetch("/db-test");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data?.message || data?.error || "DB test error");
    }
    dbNode.textContent = `DB bağlıdır (${new Date(data.now).toLocaleString("az-AZ")})`;
    dbNode.className = "status ok";
  } catch (error) {
    dbNode.textContent = `DB xətası: ${error.message}`;
    dbNode.className = "status error";
  }
}

function setupChat() {
  if (!chatForm || !chatInput || !chatLog) return;

  addBubble(
    "bot",
    "Salam. Mən KutleWe AI köməkçisiyəm. Karyera, internship və forum suallarını yaza bilərsiniz."
  );

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = String(chatInput.value || "").trim();
    if (!message) return;
    chatInput.value = "";
    await sendMessage(message);
  });

  quickPromptButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = String(button.textContent || "").trim();
      if (!prompt) return;
      await sendMessage(prompt);
    });
  });
}

async function sendMessage(message) {
  addBubble("user", message);
  setChatError("");
  addBubble("bot", "Yazılır...", "typing");

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    removeTypingBubble();

    if (!response.ok || !data.ok) {
      throw new Error(data?.message || "Chat endpoint xətası");
    }

    addBubble("bot", data.reply || "Cavab alınmadı.");
  } catch (error) {
    removeTypingBubble();
    setChatError(error.message);
    addBubble("bot", "Hazırda cavab ala bilmədim. Bir azdan yenidən yoxlayın.");
  }
}

function addBubble(type, text, id = "") {
  if (!chatLog) return;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type}`;
  if (id) bubble.dataset.id = id;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function removeTypingBubble() {
  if (!chatLog) return;
  const typing = chatLog.querySelector('[data-id="typing"]');
  if (typing) typing.remove();
}

function setChatError(message) {
  if (!chatError) return;
  chatError.textContent = message || "";
}
