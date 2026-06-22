// Types partagés frontend <-> backend

export interface GeneralInfo {
  clientFirstName: string;
  clientLastName: string;
  advisorFirstName: string;
  advisorLastName: string;
  advisorPhone: string;
  advisorEmail: string;
}

export type MandateType = 'simple' | 'exclusif';

export interface Listing {
  id: string;
  title: string;
  city: string;
  postalCode: string;
  surface: number;
  rooms: number;
  bedrooms: number;
  landSurface?: number;
  dpe?: string;
  ges?: string;
  description: string;
  features: string[];

  netSellerPrice: number;
  mandateType: MandateType;
  commissionOverride?: number; // force le montant € si renseigné
  notaryRate: number;          // % frais de notaire
  isNewBuild: boolean;         // neuf (3%) vs ancien (8,5%)

  advisorComment: string;
  /** Chemins des photos source (insérées telles quelles, non modifiées). */
  photos: string[];
}

export interface MandateRate {
  rate: number;  // % TTC
  floor: number; // honoraires minimum €
}

export interface Settings {
  mandates: Record<MandateType, MandateRate>;
  notaryRate: number;     // % ancien (8,5)
  notaryRateNew: number;  // % neuf (3)
  notaryBase: 'net' | 'net_plus_commission';
}

export interface CostBreakdown {
  netSellerPrice: number;
  commission: number;
  notary: number;
  total: number;          // prix net + commission + notaire
}
