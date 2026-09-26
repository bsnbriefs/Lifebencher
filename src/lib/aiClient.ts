import { auth } from './firebase';

async function headers(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'AI request failed');
  return data;
}

export function assistProfile(payload: {
  bio: string;
  displayName?: string;
  profession?: string;
  location?: string;
  relationshipGoal?: string;
}) {
  return post<{ suggestedBio: string; missing: string[]; notes: string }>('/api/ai/profile-assist', payload);
}

export function reviewReceipt(payload: {
  receiptUrl: string;
  txId: string;
  expectedAmountNgn: number;
  productName: string;
}) {
  return post<{ note: string; confidence: number }>('/api/ai/receipt-review', payload);
}

export function scanText(payload: { text: string; kind: 'bio' | 'message'; targetId?: string }) {
  return post<{ flagged: boolean; reason?: string }>('/api/ai/safety-scan', payload);
}

export function explainMatch(payload: {
  score: number;
  summary?: string;
  me: Record<string, unknown>;
  them: Record<string, unknown>;
}) {
  return post<{ explanation: string; starters: string[] }>('/api/ai/match-explain', payload);
}

export function askSupport(question: string) {
  return post<{ answer: string }>('/api/ai/support', { question });
}
