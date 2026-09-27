export function aiConfig() {
  const key = process.env.AI_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error('unavailable');
    err.status = 503;
    throw err;
  }
  const base = (process.env.AI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'grok-3-mini';
  return { key, base, model };
}

function extractText(body) {
  return body?.choices?.[0]?.message?.content || '';
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
        /* fall through */
      }
    }
    return { raw: String(text).slice(0, 2000), suggestedBio: String(text).slice(0, 1000), answer: String(text).slice(0, 800) };
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

  const payload = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content }
    ]
  };

  let res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...payload, response_format: { type: 'json_object' } })
  });
  let body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('AI provider error', res.status, body?.error?.type || body?.error?.code || 'unknown');
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    body = await res.json().catch(() => ({}));
  }

  const text = extractText(body);
  if (!res.ok || !text) {
    console.error('AI empty response', res.status);
    const err = new Error('unavailable');
    err.status = 503;
    throw err;
  }
  return parseJsonLoose(text);
}
