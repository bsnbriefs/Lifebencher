export type ProductKind =
  | 'subscription'
  | 'matchmaking'
  | 'concierge'
  | 'spotlight'
  | 'super_interest'
  | 'verification'
  | 'extra_match'
  | 'extension'
  | 'event';

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
    summary: 'More discovery tools and one Spotlight each month.',
    bullets: ['Advanced discovery tools', '1 Spotlight / month', 'Priority support queue']
  },
  {
    id: 'priority_monthly',
    kind: 'subscription',
    name: 'Lifebencher Priority',
    priceNgn: 15000,
    priceLabel: '₦15,000/mo',
    cadence: 'monthly',
    summary: 'Higher visibility and three Spotlights each month.',
    bullets: ['Everything in Plus', '3 Spotlights / month', 'Priority discovery placement']
  },
  {
    id: 'matchmaking_local',
    kind: 'matchmaking',
    name: 'Local Matchmaking',
    priceNgn: 30000,
    priceLabel: '₦30,000',
    cadence: 'one_time',
    summary: 'Human-assisted introductions in Nigeria. Up to 3 matches.',
    bullets: ['Concierge introductions', 'Up to 3 matches', 'Existing 7-day connection rules apply']
  },
  {
    id: 'matchmaking_international',
    kind: 'matchmaking',
    name: 'International Matchmaking',
    priceNgn: 50000,
    priceLabel: '₦50,000',
    cadence: 'one_time',
    summary: 'Human-assisted introductions across borders. Up to 3 matches.',
    bullets: ['International search', 'Up to 3 matches', 'Existing matching workflow unchanged']
  },
  {
    id: 'concierge_150',
    kind: 'concierge',
    name: 'Concierge Essential',
    priceNgn: 150000,
    priceLabel: '₦150,000',
    cadence: 'one_time',
    summary: 'Dedicated human matchmaking support. Not automated.',
    bullets: ['Personal coordinator', 'Candidate screening', 'Follow-up support']
  },
  {
    id: 'concierge_200',
    kind: 'concierge',
    name: 'Concierge Plus',
    priceNgn: 200000,
    priceLabel: '₦200,000',
    cadence: 'one_time',
    summary: 'Expanded search and coordination by the concierge team.',
    bullets: ['Dedicated search', 'Introductions', 'Ongoing coordination']
  },
  {
    id: 'concierge_350',
    kind: 'concierge',
    name: 'Concierge Private',
    priceNgn: 350000,
    priceLabel: '₦350,000',
    cadence: 'one_time',
    summary: 'Highest-touch private matchmaking service.',
    bullets: ['Private search', 'Screening & coordination', 'Priority concierge desk']
  },
  {
    id: 'spotlight_24h',
    kind: 'spotlight',
    name: 'Spotlight 24 hours',
    priceNgn: 1000,
    priceLabel: '₦1,000',
    cadence: 'one_time',
    summary: 'Raise visibility in Discover for 24 hours.',
    bullets: ['24-hour Discover boost']
  },
  {
    id: 'spotlight_3d',
    kind: 'spotlight',
    name: 'Spotlight 3 days',
    priceNgn: 2500,
    priceLabel: '₦2,500',
    cadence: 'one_time',
    summary: 'Raise visibility in Discover for 3 days.',
    bullets: ['3-day Discover boost']
  },
  {
    id: 'spotlight_7d',
    kind: 'spotlight',
    name: 'Spotlight 7 days',
    priceNgn: 5000,
    priceLabel: '₦5,000',
    cadence: 'one_time',
    summary: 'Raise visibility in Discover for 7 days.',
    bullets: ['7-day Discover boost']
  },
  {
    id: 'super_1',
    kind: 'super_interest',
    name: '1 Super Interest',
    priceNgn: 500,
    priceLabel: '₦500',
    cadence: 'one_time',
    summary: 'Send one highlighted interest.',
    bullets: ['1 Super Interest credit']
  },
  {
    id: 'super_5',
    kind: 'super_interest',
    name: '5 Super Interests',
    priceNgn: 2000,
    priceLabel: '₦2,000',
    cadence: 'one_time',
    summary: 'Bundle of five highlighted interests.',
    bullets: ['5 Super Interest credits']
  },
  {
    id: 'super_15',
    kind: 'super_interest',
    name: '15 Super Interests',
    priceNgn: 5000,
    priceLabel: '₦5,000',
    cadence: 'one_time',
    summary: 'Bundle of fifteen highlighted interests.',
    bullets: ['15 Super Interest credits']
  },
  {
    id: 'verification_request',
    kind: 'verification',
    name: 'Verification request',
    priceNgn: 5000,
    priceLabel: '₦5,000',
    cadence: 'one_time',
    summary: 'Pays for a review. Admin still approves the badge.',
    bullets: ['Verification review', 'Badge only after admin approval']
  },
  {
    id: 'extra_match',
    kind: 'extra_match',
    name: 'Extra introduction',
    priceNgn: 10000,
    priceLabel: '₦10,000',
    cadence: 'one_time',
    summary: 'One additional matchmaking introduction after your included allocation.',
    bullets: ['+1 introduction']
  },
  {
    id: 'ext_7',
    kind: 'extension',
    name: '7-day connection extension',
    priceNgn: 5000,
    priceLabel: '₦5,000',
    cadence: 'one_time',
    summary: 'Extend an active 7-day connection.',
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
