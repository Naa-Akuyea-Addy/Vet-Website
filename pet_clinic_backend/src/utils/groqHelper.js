const { Groq } = require("groq-sdk");
const crypto = require("crypto");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 20000,
  maxRetries: 1,
});

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function groqChat(prompt, systemPrompt = "", responseFormat = null) {
  const hash = crypto.createHash("sha256").update(prompt + systemPrompt).digest("hex");
  
  if (cache.has(hash)) {
    const cached = cache.get(hash);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.text;
    }
    cache.delete(hash);
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  
  const options = {
    messages,
    model: "openai/gpt-oss-120b",
  };
  if (responseFormat) {
    options.response_format = responseFormat;
  }

  try {
    const completion = await groq.chat.completions.create(options);
    const text = completion.choices[0]?.message?.content || "";
    cache.set(hash, { text, timestamp: Date.now() });
    return text;
  } catch (err) {
    console.warn("Primary model failed, falling back to 20b...", err.message);
    const fallbackOptions = {
      messages,
      model: "openai/gpt-oss-20b",
    };
    if (responseFormat) {
      fallbackOptions.response_format = responseFormat;
    }
    const completionFallback = await groq.chat.completions.create(fallbackOptions);
    const text = completionFallback.choices[0]?.message?.content || "";
    cache.set(hash, { text, timestamp: Date.now() });
    return text;
  }
}

module.exports = { groqChat };
