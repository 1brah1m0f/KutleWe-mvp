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

  if (filterForm) {
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const filters = readFiltersFromForm();
      loadOpportunities(filters);
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      applyFiltersToForm(defaultFilters);
      aiFeedback.textContent = "";
      loadOpportunities(defaultFilters);
    });
  }

  if (aiFilterForm) {
    aiFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAiFilter();
    });
  }
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
  setLoadingState("Fürsətlər yüklənir...");

  try {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        query.set(key, value);
      }
    });

    const url = query.toString() ? `/api/opportunities?${query.toString()}` : "/api/opportunities";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Fürsət API xətası");
    }

    const data = await response.json();
    renderOpportunities(data.opportunities || []);
    if (resultMeta) {
      resultMeta.textContent = `${data.total || 0} nəticə tapıldı`;
    }
  } catch (_error) {
    renderEmpty("Fürsətlər yüklənmədi.");
  }
}

async function runAiFilter() {
  const prompt = String(aiPromptInput?.value || "").trim();
  if (!prompt) {
    aiFeedback.textContent = "AI filtr üçün mətn daxil edin.";
    return;
  }

  setLoadingState("AI filtr tətbiq olunur...");
  aiFeedback.textContent = "AI analiz edir...";

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
      throw new Error(data?.message || "AI filtr xətası");
    }

    applyFiltersToForm(data.filters || defaultFilters);
    renderOpportunities(data.opportunities || []);
    if (resultMeta) {
      resultMeta.textContent = `${data.total || 0} nəticə tapıldı`;
    }

    if (aiFeedback) {
      aiFeedback.textContent = `${data.ai?.reason || "AI filtr tətbiq olundu."} Mənbə: ${
        data.ai?.source || "unknown"
      }`;
    }
  } catch (error) {
    renderEmpty("AI filtr nəticə qaytarmadı.");
    if (aiFeedback) {
      aiFeedback.textContent = `Xəta: ${error.message}`;
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
  listContainer.innerHTML = `<div class="empty-box">${text}</div>`;
}

function renderOpportunities(opportunities) {
  if (!listContainer) return;

  if (opportunities.length === 0) {
    renderEmpty("Filtrə uyğun nəticə yoxdur.");
    return;
  }

  listContainer.innerHTML = "";
  opportunities.forEach((item) => {
    const card = document.createElement("article");
    card.className = "opportunity-card";

    const header = document.createElement("div");
    header.className = "card-head";
    header.innerHTML = `
      <span class="pill">${item.category_label}</span>
      <span class="deadline">Son tarix: ${formatDate(item.deadline_date)}</span>
    `;

    const title = document.createElement("h3");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    const meta = document.createElement("div");
    meta.className = "card-footer";
    meta.innerHTML = `
      <span>${item.organization}</span>
      <span>${item.location}</span>
      <span>${item.mode}</span>
      <span>${item.duration || "-"}</span>
    `;

    const action = document.createElement("a");
    action.className = "btn btn-primary";
    action.href = item.external_url || "#";
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.style.marginTop = "0.7rem";
    action.textContent = "Detallara bax";

    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(meta);
    card.appendChild(action);
    listContainer.appendChild(card);
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long" }).format(date);
}
