const filterForm = document.getElementById("filter-form");
const aiFilterForm = document.getElementById("ai-filter-form");
const resetButton = document.getElementById("reset-filters");
const listContainer = document.getElementById("opportunity-list");
const resultMeta = document.getElementById("result-meta");
const aiFeedback = document.getElementById("ai-feedback");

const categoryInput = document.getElementById("category");
const modeInput = document.getElementById("mode");
const locationInput = document.getElementById("location");
const deadlineInput = document.getElementById("deadlineBefore");
const searchInput = document.getElementById("search");
const aiPromptInput = document.getElementById("aiPrompt");

const defaultFilters = {
  categoryKey: "all",
  mode: "all",
  location: "",
  deadlineBefore: "",
  search: ""
};

initializeOpportunityPage();

function initializeOpportunityPage() {
  loadOpportunities(defaultFilters);

  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const filters = readFiltersFromForm();
    loadOpportunities(filters);
  });

  resetButton?.addEventListener("click", () => {
    applyFiltersToForm(defaultFilters);
    if (aiFeedback) aiFeedback.textContent = "";
    loadOpportunities(defaultFilters);
  });

  aiFilterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAiFilter();
  });
}

function readFiltersFromForm() {
  return {
    categoryKey: categoryInput?.value || "all",
    mode: modeInput?.value || "all",
    location: locationInput?.value?.trim() || "",
    deadlineBefore: deadlineInput?.value || "",
    search: searchInput?.value?.trim() || ""
  };
}

function applyFiltersToForm(filters) {
  if (categoryInput) categoryInput.value = filters.categoryKey || "all";
  if (modeInput) modeInput.value = filters.mode || "all";
  if (locationInput) locationInput.value = filters.location || "";
  if (deadlineInput) deadlineInput.value = filters.deadlineBefore || "";
  if (searchInput) searchInput.value = filters.search || "";
}

async function loadOpportunities(filters) {
  setLoadingState("Yuklenir...");

  try {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        query.set(key, value);
      }
    });
    const url = query.toString() ? `/api/opportunities?${query.toString()}` : "/api/opportunities";

    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Yuklenmedi.");
    }

    renderOpportunities(data.opportunities || []);
    if (resultMeta) {
      resultMeta.textContent = `${data.total || 0} netice tapildi`;
    }
  } catch (error) {
    renderEmpty(`Xeta: ${error.message}`);
  }
}

async function runAiFilter() {
  const prompt = String(aiPromptInput?.value || "").trim();
  if (!prompt) {
    if (aiFeedback) {
      aiFeedback.textContent = "AI sorğusu bos ola bilmez.";
      aiFeedback.className = "status error";
    }
    return;
  }

  if (aiFeedback) {
    aiFeedback.textContent = "AI analiz edir...";
    aiFeedback.className = "status warn";
  }

  try {
    const response = await fetch("/api/opportunities/ai-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        currentFilters: readFiltersFromForm()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "AI filtr xetasi");
    }

    applyFiltersToForm(data.filters || defaultFilters);
    renderOpportunities(data.opportunities || []);
    if (resultMeta) {
      resultMeta.textContent = `${data.total || 0} netice tapildi`;
    }
    if (aiFeedback) {
      aiFeedback.textContent = data.ai?.reason || "AI filtr tetbiq edildi.";
      aiFeedback.className = "status ok";
    }
  } catch (error) {
    if (aiFeedback) {
      aiFeedback.textContent = error.message;
      aiFeedback.className = "status error";
    }
  }
}

function setLoadingState(text) {
  if (resultMeta) {
    resultMeta.textContent = text;
  }
  if (listContainer) {
    listContainer.innerHTML = "";
  }
}

function renderEmpty(text) {
  if (!listContainer) return;
  listContainer.innerHTML = `<div class="list-item muted">${text}</div>`;
}

function renderOpportunities(opportunities) {
  if (!listContainer) return;

  if (opportunities.length === 0) {
    renderEmpty("Filtre uygun netice yoxdur.");
    return;
  }

  listContainer.innerHTML = "";
  opportunities.forEach((item) => {
    const card = document.createElement("article");
    card.className = "list-item";
    card.innerHTML = `
      <div class="actions" style="justify-content:space-between">
        <span class="badge">${escapeHtml(item.category_label)}</span>
        <span class="meta">Son tarix: ${formatDate(item.deadline_date)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="meta">${escapeHtml(item.organization)} | ${escapeHtml(item.location)} | ${escapeHtml(item.mode)}</div>
      <div class="actions" style="margin-top:0.5rem">
        <a class="btn btn-outline" target="_blank" rel="noopener noreferrer" href="${
          item.external_url || "#"
        }">Detallar</a>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "2-digit" }).format(date);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
