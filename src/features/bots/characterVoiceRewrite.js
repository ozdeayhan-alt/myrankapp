const { TWEET_MAX_LENGTH } = require("../posts/updatePostContent");

function isCharacterAiEnabled() {
  const raw = process.env.CHARACTER_AI_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false") {
    return false;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function buildSystemPrompt(persona) {
  const voice = persona.voice ?? {};
  return [
    `Sen "${persona.displayName}" adlı MyRank kullanıcısısın.`,
    "Haber spikeri gibi konuşma. Resmi dil kullanma.",
    "Amaç haber vermek değil, insanların yorum yapmasını sağlamak.",
    "Başlığı veya haberi kopyalama. Kendi cümlelerinle yaz.",
    "Sonunda doğal bir tartışma sorusu sor.",
    "URL veya kaynak adı yazma.",
    `Emoji: ${voice.emojiLevel ?? "low"}. Ton: ${voice.tone ?? "casual"}.`,
    `Cümle uzunluğu: ${voice.length ?? "medium"}. Mizah: ${voice.humor ?? "light"}.`,
    `En fazla ${TWEET_MAX_LENGTH} karakter.`,
  ].join(" ");
}

function buildUserPrompt({ contentType, seedText, newsItem }) {
  if (newsItem) {
    return [
      `İçerik tipi: ${contentType}`,
      `Haber ipucu (kopyalama): başlık="${newsItem.title}"`,
      newsItem.description
        ? `kısa özet ipucu="${newsItem.description.slice(0, 200)}"`
        : null,
      "Bunu kendi cümlelerinle kısa bir Whisp'e çevir ve soru sor.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `İçerik tipi: ${contentType}`,
    `Konu: ${seedText}`,
    "Bunu doğal, samimi bir Whisp'e çevir ve tartışma sorusu ekle.",
  ].join("\n");
}

async function rewriteWithAi({ persona, contentType, seedText, newsItem }) {
  if (!isCharacterAiEnabled()) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY.trim();
  const model = process.env.CHARACTER_AI_MODEL?.trim() || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: 180,
      messages: [
        { role: "system", content: buildSystemPrompt(persona) },
        {
          role: "user",
          content: buildUserPrompt({ contentType, seedText, newsItem }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}

module.exports = {
  isCharacterAiEnabled,
  rewriteWithAi,
  buildSystemPrompt,
};
