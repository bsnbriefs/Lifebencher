import { auth } from './firebase';

async function authHeader(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function startFlutterwaveCheckout(productId: string, extras?: { matchId?: string }): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const res = await fetch('/api/flutterwave/init', {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({
      productId,
      matchId: extras?.matchId,
      email: user.email,
      name: user.displayName,
      origin: window.location.origin
    })
  });
  const data = (await res.json()) as { link?: string; error?: string };
  if (!res.ok || !data.link) throw new Error(data.error || 'Could not start Flutterwave checkout');
  window.location.href = data.link;
}

export async function confirmFlutterwaveReturn(): Promise<{ verified: boolean; message: string }> {
  const params = new URLSearchParams(window.location.search);
  if (params.get('flw') !== '1' && !params.get('transaction_id')) {
    return { verified: false, message: '' };
  }
  const status = params.get('status') || '';
  const txRef = params.get('tx_ref') || '';
  const transactionId = params.get('transaction_id') || '';
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  if (status === 'cancelled' || status === 'failed') {
    return { verified: false, message: 'Payment was cancelled or failed. Discover stays locked.' };
  }
  if (!txRef || !transactionId) {
    return { verified: false, message: 'Payment returned without a reference. Try again or wait for confirmation.' };
  }

  const res = await fetch('/api/flutterwave/verify', {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId })
  });
  const data = (await res.json()) as { verified?: boolean; error?: string };
  if (!res.ok || !data.verified) {
    return { verified: false, message: data.error || 'Payment is not confirmed yet.' };
  }
  return { verified: true, message: 'Payment verified. Your package is now active.' };
}
