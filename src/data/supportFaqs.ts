export type SupportFaq = {
  id: string;
  category: string;
  question: string;
  keywords: string[];
  answer: string;
};

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: 'how-works',
    category: 'Getting Started',
    question: 'How does Lifebencher Match work?',
    keywords: ['how', 'work', 'lifebencher', 'match', 'what is'],
    answer:
      'Create an account with email or Google, complete your profile with 2–3 recent photos, then choose Nigeria (₦30,000) or International (₦50,000) matchmaking. After Flutterwave payment or an approved prior-payment receipt, your profile can appear on Discover. Mutual interest opens a 7-day connection.'
  },
  {
    id: 'cost',
    category: 'Membership',
    question: 'How much does membership cost?',
    keywords: ['cost', 'price', 'naira', 'fee', 'membership', 'boost', 'plus'],
    answer:
      'Nigeria matchmaking is ₦30,000 one-time (up to 3 introductions). International is ₦50,000 one-time (up to 3). Lifebencher Plus is ₦5,000/month. Profile Boost is ₦1,000 for 24 hours. Extra introduction is ₦10,000.'
  },
  {
    id: 'local',
    category: 'Local Matchmaking',
    question: 'What is local / Nigeria matchmaking?',
    keywords: ['local', 'nigeria', '30000', '30,000'],
    answer:
      'Nigeria matchmaking is the local pool. After payment or approved proof, you only see other local members on Discover. It includes up to 3 introductions.'
  },
  {
    id: 'intl',
    category: 'International Matchmaking',
    question: 'What is international matchmaking?',
    keywords: ['international', 'abroad', '50000', '50,000'],
    answer:
      'International matchmaking is the abroad pool at ₦50,000 one-time, up to 3 introductions. You only see other international members on Discover after payment is verified.'
  },
  {
    id: 'pay',
    category: 'Payments',
    question: 'How do I pay?',
    keywords: ['pay', 'flutterwave', 'card', 'payment'],
    answer:
      'New payments use Flutterwave checkout from the matchmaking pay screen. Successful verification unlocks the package. Do not send card numbers in chat.'
  },
  {
    id: 'receipt',
    category: 'Payments',
    question: 'I already paid before the website. How do I submit a receipt?',
    keywords: ['receipt', 'already paid', 'bank', 'transfer'],
    answer:
      'On the matchmaking pay screen choose your package, tap that you already paid, upload a receipt or bank alert from your gallery, and submit. Admin confirms it on Billing. Do not pay again.'
  },
  {
    id: 'login',
    category: 'Registration & Login',
    question: 'How do I sign in?',
    keywords: ['login', 'sign in', 'google', 'password', 'email'],
    answer:
      'Use email and password, Continue with Google, or Email me a sign-in link. Forgot password sends a reset email. Phone SMS login is not offered.'
  },
  {
    id: 'profile',
    category: 'Profile',
    question: 'How do I complete my profile?',
    keywords: ['profile', 'photos', 'bio', 'complete'],
    answer:
      'Add your name, age, location, profession, bio, values, and 2–3 recent photos. One photo is your profile picture. You can edit later from Profile.'
  },
  {
    id: 'verify',
    category: 'Verification',
    question: 'How does verification work?',
    keywords: ['verify', 'approval', 'visible', 'get approved'],
    answer:
      'Profiles stay hidden on Discover until matchmaking payment is verified or an admin approves the profile. Admin review is in the Admin Backend Verification and Billing tabs.'
  },
  {
    id: 'discover',
    category: 'Discover',
    question: 'Why don’t I see people on Discover?',
    keywords: ['discover', 'hidden', 'empty'],
    answer:
      'You only see other visible members in the same pool (local or international). Your own profile stays hidden until payment/approval. Admins never appear on Discover.'
  },
  {
    id: 'matching',
    category: 'Matching',
    question: 'How do I get matched?',
    keywords: ['match', 'interest', 'introduction', 'how many'],
    answer:
      'On Discover, send interest. If they accept, a 7-day connection opens under Matches and Messages. Packages include up to 3 introductions unless you buy an extra one.'
  },
  {
    id: 'pwa',
    category: 'Technical Issues',
    question: 'How do I install the app?',
    keywords: ['install', 'pwa', 'home screen'],
    answer:
      'On Android Chrome use Install Lifebencher Match when the prompt appears. On iPhone Safari tap Share → Add to Home Screen.'
  },
  {
    id: 'admin-help',
    category: 'Other',
    question: 'How do I contact an admin?',
    keywords: ['admin', 'human', 'help', 'support', 'contact an admin'],
    answer:
      'Open Support and tap Talk to an Admin. An admin replies in that same chat from the Admin Backend Support inbox.'
  }
];

export const SUGGESTED_FAQ_IDS = ['how-works', 'cost', 'profile', 'verify', 'matching', 'admin-help'];

const ESCALATE_RE =
  /\b(refund|pending payment|not approved|haven't been approved|hasnt been approved|receipt not|wrong package|charged twice|where is my payment|still pending|my payment)\b/i;

export function shouldEscalateToAdmin(question: string): boolean {
  const s = question.toLowerCase();
  if (/how do i contact/.test(s)) return false;
  if (/\b(complaint|report user|speak to (an )?admin|talk to (an )?admin)\b/.test(s)) return true;
  return ESCALATE_RE.test(s);
}

export function matchSupportFaq(question: string): SupportFaq | null {
  const s = question.toLowerCase().replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (shouldEscalateToAdmin(question)) return null;
  let best: SupportFaq | null = null;
  let bestScore = 0;
  for (const faq of SUPPORT_FAQS) {
    let score = 0;
    if (faq.question.toLowerCase() === question.trim().toLowerCase()) score += 20;
    for (const k of faq.keywords) {
      if (s.includes(k.toLowerCase())) score += 2;
    }
    if ((s.includes('how much') || s.includes('cost') || s.includes('price')) && faq.id === 'cost') score += 6;
    if (s.includes('work') && faq.id === 'how-works') score += 4;
    if (s.includes('what is lifebencher') && faq.id === 'how-works') score += 8;
    if (s.includes('boost') && faq.id === 'cost') score += 5;
    if (s.includes('plus') && faq.id === 'cost') score += 3;
    if (s.includes('how many') && faq.id === 'matching') score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }
  return bestScore >= 2 ? best : null;
}
