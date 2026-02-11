const { normalizeFilters, ruleBasedOpportunityIntent } = require("./filter-service");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

async function callOpenAI(messages, responseAsJson = false) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const payload = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages
  };

  if (responseAsJson) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI xətası: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

function fallbackChatReply(message, context) {
  const text = String(message || "").toLowerCase();

  if (!text.trim()) {
    return "Mesaj boşdur. Sualınızı qısa şəkildə yaza bilərsiniz.";
  }

  if (text.includes("təcrübə") || text.includes("intern")) {
    return "Təcrübə elanlarını `Fürsətlər` səhifəsində kateqoriyanı `Təcrübə` seçərək görə bilərsiniz.";
  }

  if (text.includes("forum") || text.includes("thread")) {
    return "Forumda mövzu açmaq üçün `Forum` səhifəsindəki formadan istifadə edin. Mövzuya cavab üçün thread detala keçin.";
  }

  if (text.includes("filtr") || text.includes("axtar")) {
    return "Fürsətlər səhifəsində adi filtr və AI filtr birlikdə işləyir. AI promptuna məsələn: `Bakıda remote data internship` yaza bilərsiniz.";
  }

  if (context?.counts?.opportunities) {
    return `Hazırda sistemdə ${context.counts.opportunities} fürsət və ${context.counts.threads} forum mövzusu var. Konkret istiqamət yazın, sizə uyğun filtr məntiqi təklif edim.`;
  }

  return "KutleWe-də fürsət axtarışı, forum müzakirəsi və thread cavabı üzrə sizə kömək edə bilərəm.";
}

async function extractOpportunityFiltersWithAI(prompt) {
  const rule = ruleBasedOpportunityIntent(prompt);

  if (!OPENAI_API_KEY) {
    return {
      source: "rule_based",
      filters: rule.filters,
      reason: rule.reason
    };
  }

  try {
    const systemPrompt =
      "Sən KutleWe üçün filtr assistentisən. İstifadəçi cümləsindən filtr çıxar. " +
      "Yalnız JSON qaytar. Sahələr: categoryKey, mode, location, deadlineBefore, keywords, search. " +
      "categoryKey yalnız: internship, volunteering, hackathon, career və ya boş string. " +
      "mode yalnız: Onsite, Hibrid, Remote və ya boş string. " +
      "deadlineBefore YYYY-MM-DD formatında və ya boş string. keywords string array olmalıdır.";

    const rawContent = await callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(prompt || "") }
      ],
      true
    );

    if (!rawContent) {
      return {
        source: "rule_based",
        filters: rule.filters,
        reason: rule.reason
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_error) {
      return {
        source: "rule_based",
        filters: rule.filters,
        reason: "AI JSON parse edilmedi, qayda əsaslı filtr tətbiq olundu."
      };
    }

    const aiFilters = normalizeFilters({
      categoryKey: parsed.categoryKey || "",
      mode: parsed.mode || "",
      location: parsed.location || "",
      deadlineBefore: parsed.deadlineBefore || "",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      search: parsed.search || ""
    });

    return {
      source: "openai",
      filters: {
        categoryKey: aiFilters.categoryKey === "all" ? "" : aiFilters.categoryKey,
        mode: aiFilters.mode === "all" ? "" : aiFilters.mode,
        location: aiFilters.location,
        deadlineBefore: aiFilters.deadlineBefore,
        keywords: aiFilters.keywords,
        search: aiFilters.search
      },
      reason: "Filtr OpenAI analizi ilə çıxarıldı."
    };
  } catch (error) {
    return {
      source: "rule_based",
      filters: rule.filters,
      reason: `AI servisi əlçatmaz oldu, qayda əsaslı filtr tətbiq edildi: ${error.message}`
    };
  }
}

async function generateChatReply(userMessage, context) {
  if (!OPENAI_API_KEY) {
    return fallbackChatReply(userMessage, context);
  }

  try {
    const systemContent =
      "Sən KutleWe platformasının AZ dilli köməkçisisən. Cavabları qısa, praktik və konkret yaz. " +
      "Mövzu fürsətlər, forum, filtr, thread cavablarıdır.";

    const contextText = context
      ? `Kontekst: ${JSON.stringify(context).slice(0, 800)}`
      : "Kontekst yoxdur.";

    const answer = await callOpenAI([
      { role: "system", content: systemContent },
      { role: "system", content: contextText },
      { role: "user", content: String(userMessage || "") }
    ]);

    if (!answer) {
      return fallbackChatReply(userMessage, context);
    }

    return answer.trim();
  } catch (_error) {
    return fallbackChatReply(userMessage, context);
  }
}

module.exports = {
  extractOpportunityFiltersWithAI,
  generateChatReply
};
