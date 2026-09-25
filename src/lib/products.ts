export type ProductKind = 'subscription' | 'matchmaking' | 'boost' | 'extra_match' | 'extension';

export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  priceNgn: number;
  priceLabel: string;
  cadence: 'monthly' | 'one_time';
  summary: string;
  bullets: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'plus_monthly',
    kind: 'subscription',
    name: 'Lifebencher Plus',
    priceNgn: 5000,
    priceLabel: '₦5,000/mo',
    cadence: 'monthly',
    summary: 'See who liked you, extra filters, visibility, and 1 boost each month.',
    bullets: [
      'See who likes you',
      'Advanced filters',
      'Increased visibility',
      'Priority access to new profiles',
      '1 profile boost per month'
    ]
  },
  {
    id: 'boost_24h',
    kind: 'boost',
    name: 'Profile Boost',
    priceNgn: 1000,
    priceLabel: '₦1,000 / 24 hours',
    cadence: 'one_time',
    summary: 'Higher placement in Discover for 24 hours.',
    bullets: ['24-hour Discover boost']
  },
  {
    id: 'matchmaking_local',
    kind: 'matchmaking',
    name: 'Nigeria Matchmaking',
    priceNgn: 30000,
    priceLabel: '₦30,000',
    cadence: 'one_time',
    summary: 'Human-assisted introductions in Nigeria. Up to 3 matches.',
    bullets: ['Up to 3 introductions', 'Existing 7-day connection rules']
  },
  {
    id: 'matchmaking_international',
    kind: 'matchmaking',
    name: 'International Matchmaking',
    priceNgn: 50000,
    priceLabel: '₦50,000',
    cadence: 'one_time',
    summary: 'Human-assisted introductions abroad. Up to 3 matches.',
    bullets: ['Up to 3 introductions', 'Existing matching workflow']
  },
  {
    id: 'extra_match',
    kind: 'extra_match',
    name: 'Extra introduction',
    priceNgn: 10000,
    priceLabel: '₦10,000',
    cadence: 'one_time',
    summary: 'One more introduction after your included 3 are used.',
    bullets: ['+1 introduction']
  },
  {
    id: 'ext_7',
    kind: 'extension',
    name: '7-day connection extension',
    priceNgn: 5000,
    priceLabel: '₦5,000',
    cadence: 'one_time',
    summary: 'Extend an active connection by 7 days.',
    bullets: ['+7 days']
  },
  {
    id: 'ext_14',
    kind: 'extension',
    name: '14-day connection extension',
    priceNgn: 9000,
    priceLabel: '₦9,000',
    cadence: 'one_time',
    summary: 'Extend an active connection by 14 days.',
    bullets: ['+14 days']
  },
  {
    id: 'ext_30',
    kind: 'extension',
    name: '30-day connection extension',
    priceNgn: 16000,
    priceLabel: '₦16,000',
    cadence: 'one_time',
    summary: 'Extend an active connection by 30 days.',
    bullets: ['+30 days']
  }
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}
