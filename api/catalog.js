export const CATALOG = {
  matchmaking_local: { id: 'matchmaking_local', name: 'Nigeria Matchmaking', priceNgn: 30000 },
  matchmaking_international: { id: 'matchmaking_international', name: 'International Matchmaking', priceNgn: 50000 },
  matchmaking_both: { id: 'matchmaking_both', name: 'Nigeria + International', priceNgn: 60000 },
  plus_monthly: { id: 'plus_monthly', name: 'Lifebencher Plus', priceNgn: 5000 },
  boost_24h: { id: 'boost_24h', name: 'Profile Boost', priceNgn: 1000 },
  extra_match: { id: 'extra_match', name: 'Extra introduction', priceNgn: 10000 },
  ext_7: { id: 'ext_7', name: '7-day connection extension', priceNgn: 5000 },
  ext_14: { id: 'ext_14', name: '14-day connection extension', priceNgn: 8000 }
};

export function productById(id) {
  return CATALOG[id] || null;
}

export function matchTypeFromProductId(productId) {
  if (productId === 'matchmaking_local') return 'local';
  if (productId === 'matchmaking_international') return 'international';
  if (productId === 'matchmaking_both') return 'both';
  return null;
}
