function aiConfig() {
  const key = process.env.AI_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error('unavailable');
    err.status = 503;
    throw err;
  }
  const base = (process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'gemini-2.5-flash-lite';
  return { key, base, model };
}

function extractText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n');
  }
  const parts = body?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map((p) => p?.text || '').join('\n');
  return '';
}

function parseJsonLoose(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* ignore */
      }
    }
    return {
      raw: String(text).slice(0, 2000),
      suggestedBio: String(text).slice(0, 1000),
      answer: String(text).slice(0, 800)
    };
  }
}

export async function chatJson(system, user, imageUrl) {
  const { key, base, model } = aiConfig();
  const content = imageUrl
    ? [
        { type: 'text', text: user },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    : user;

  const isGemini = base.includes('generativelanguage.googleapis.com');
  const url = isGemini
    ? `${base}/chat/completions?key=${encodeURIComponent(key)}`
    : `${base}/chat/completions`;

  const payload = {
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('AI provider error', res.status, body?.error?.status || body?.error?.code || 'unknown');
  }
  const text = extractText(body);
  if (!res.ok || !text) {
    const err = new Error('unavailable');
    err.status = 503;
    throw err;
  }
  return parseJsonLoose(text);
}
