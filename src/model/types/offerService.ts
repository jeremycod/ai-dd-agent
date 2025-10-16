



export type OfferType = 'STANDARD_TIER' | 'PROMOTIONAL_OFFER' | 'TRIAL_OFFER' | 'MIGRATION_OFFER';
export type OfferProductType = 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'WEEKLY' | 'DAILY';
export type AccountingType = 'USER_PAID' | 'COMPLIMENTARY';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type DurationUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';


export type PhaseType = 'PREPAID' | 'RECURRING' | 'TRIAL';

export type BillingPeriod = DurationUnit | null;
export type Currency = string;
export type Reason =
    | "NO_CHANGE"
    | "PRICE_CHANGE"
    | "PROMOTION_EXPIRATION"
    | "LEGAL_COMPLIANCE"
    | "MLB_SEASON_END"
    | "STUDENT_EXPIRED"
    | null;

export interface DiscountedDuration {
  length: number;
  unit: DurationUnit;
}

export interface FreeTrialDuration {
  length: number;
  unit: DurationUnit;
}


export interface Pricing {
  amount: number;
  billingPeriod: BillingPeriod;
  currency: Currency;
  reason: Reason;
  discountedDuration: DiscountedDuration | null;
  freeTrialDuration: FreeTrialDuration | null;
  product: [];
}



export interface PriceAmount {
  amount: number;
}

export interface ProductId {
  id: string;
}

export interface LegacyIds {
  dssOfferId: string | null;
  huluBundleId: string | null;
  huluProgramId: string | null;
}

export interface ProductLegacyIds {
  dssProductId: string | null;
}

export interface Duration {
  unit: DurationUnit | null;
  length: number;
}



export interface OfferPackage {
  id: string;
  name: string;
}

export interface EligibleCohort {
  name: string;
}

export interface CohortEligibility {
  eligibleCohorts: EligibleCohort[];
}

export interface OfferEligibility {
  cohortEligibility: CohortEligibility;
}

export interface Availability {
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface DiscountPrice {
  product: ProductId;
  price: PriceAmount;
}

export interface Discount {
  id: string;
  type: DiscountType;
  duration: Duration | null;
  paymentDuration: Duration | null;
  discountPrices: DiscountPrice[];
}

export interface Phase {
  id: string;
  discounts: Discount[];
  phaseType: PhaseType;
  repeatCount: number | null;
  accountingType: AccountingType;
  finalPrice: number;
  duration: Duration | null;
}

export interface Schedule {
  phases: Phase[];
}

export interface Entitlement {
  name: string;
}

export interface ProductDetails {
  id: string;
  name: string;
  entitlements: Entitlement[];
  legacyIds: ProductLegacyIds;
}

export interface OfferProduct {
  offerProductType: OfferProductType;
  basePrice: PriceAmount;
  product: ProductDetails;
  schedule: Schedule;
}

export interface Offer {
  id: string;
  name: string;
  offerType: OfferType;
  packages: OfferPackage[];
  offerEligibility: OfferEligibility;
  availability: Availability;
  legacyIds: LegacyIds;
  discounts: Discount[];
  products: OfferProduct[];
  pricing: Pricing[];
  labels: string[];
  accountingEntity: null;
}


export interface OfferServiceResponse {
  data?: {
    offers: Offer[];
  };
  error?: string;
  success?: boolean;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}