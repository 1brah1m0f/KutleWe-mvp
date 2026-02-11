(function initKutleWeBase() {
  highlightActiveMenu();
  mountChatbot();
})();

function highlightActiveMenu() {
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

function mountChatbot() {
  const root = document.getElementById("chatbot-root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <section class="chatbot" aria-label="AI çat bot">
      <div class="chatbot-panel" id="chatbot-panel">
        <header class="chat-header">
          <strong>KutleWe AI köməkçi</strong>
          <button class="chat-close" type="button" id="chat-close" aria-label="Bağla">✕</button>
        </header>
        <div class="chat-messages" id="chat-messages"></div>
        <form class="chat-form" id="chat-form">
          <input id="chat-input" placeholder="Sualınızı yazın..." />
          <button type="submit">Göndər</button>
        </form>
      </div>
      <button class="chatbot-toggle" type="button" id="chat-toggle" aria-label="Çatı aç">AI</button>
    </section>
  `;

  const panel = document.getElementById("chatbot-panel");
  const toggleButton = document.getElementById("chat-toggle");
  const closeButton = document.getElementById("chat-close");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messageBox = document.getElementById("chat-messages");

  if (!panel || !toggleButton || !closeButton || !form || !input || !messageBox) {
    return;
  }

  const addMessage = (type, text) => {
    const message = document.createElement("div");
    message.className = `chat-msg ${type}`;
    message.textContent = text;
    messageBox.appendChild(message);
    messageBox.scrollTop = messageBox.scrollHeight;
  };

  addMessage(
    "bot",
    "Salam. Mən KutleWe AI köməkçisiyəm. Fürsət, filtr və forum suallarınız üçün yazın."
  );

  toggleButton.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  closeButton.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = String(input.value || "").trim();
    if (!value) {
      return;
    }

    addMessage("user", value);
    input.value = "";

    const loadingMessage = document.createElement("div");
    loadingMessage.className = "chat-msg bot";
    loadingMessage.textContent = "Yazılır...";
    messageBox.appendChild(loadingMessage);
    messageBox.scrollTop = messageBox.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          page: window.location.pathname
        })
      });

      let replyText = "Xəta baş verdi. Bir azdan yenidən yoxlayın.";
      if (response.ok) {
        const data = await response.json();
        if (data?.reply) {
          replyText = data.reply;
        }
      }

      loadingMessage.remove();
      addMessage("bot", replyText);
    } catch (_error) {
      loadingMessage.remove();
      addMessage("bot", "Serverlə əlaqə qurulmadı.");
    }
  });
}
