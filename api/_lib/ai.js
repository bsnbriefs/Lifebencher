export function aiConfig() {
  const key = process.env.AI_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('AI_API_KEY is not set on the server');
  const base = (process.env.AI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'grok-4-fast-non-reasoning';
  return { key, base, model };
}

export async function chatJson(system, user, imageUrl) {
  const { key, base, model } = aiConfig();
  const content = imageUrl
    ? [
        { type: 'text', text: user },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    : user;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content }
      ]
    })
  });
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!res.ok || !text) {
    throw new Error(body?.error?.message || 'AI request failed');
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: String(text).slice(0, 2000) };
  }
}
