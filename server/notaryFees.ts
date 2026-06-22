import type { Listing, CostBreakdown, Settings } from '../src/types/index.ts';

export function computeCommission(l: Listing, s: Settings): number {
  if (l.commissionOverride != null) return l.commissionOverride;
  const m = s.mandates[l.mandateType];
  return Math.max((l.netSellerPrice * m.rate) / 100, m.floor);
}

export function computeGlobalCost(l: Listing, s: Settings): CostBreakdown {
  const commission = computeCommission(l, s);
  const base = s.notaryBase === 'net_plus_commission' ? l.netSellerPrice + commission : l.netSellerPrice;
  const notary = (base * l.notaryRate) / 100;
  const negotiationFee =
    l.negotiationAmount != null ? (l.negotiationAmount * s.negotiationRate) / 100 : undefined;
  return {
    netSellerPrice: l.netSellerPrice,
    commission,
    notary,
    total: l.netSellerPrice + commission + notary,
    negotiationFee,
  };
}
