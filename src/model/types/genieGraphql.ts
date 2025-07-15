// types/graphql.d.ts (or wherever you keep your types)

export type OfferBillingType = 'ONE_TIME' | 'RECURRING' | 'FREE'; // Example, adjust based on your schema
export type PriceType = 'NET' | 'GROSS'; // Example
export type OfferStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'; // Example

export interface ReferenceLink {
  key: string;
  url: string;
}

export interface Entitlement {
  id: string;
  name: string;
}

export interface EntitlementValue {
  default?: string;
  enumerations?: string[];
  max?: number;
  min?: number;
}

export interface EntitlementTierDefinition {
  entitlement: {
    id: string;
    type: string;
    values?: EntitlementValue;
  };
}

export interface TierDefinition {
  countryIds: string[];
  entitlementTierDefinitions: EntitlementTierDefinition[];
}

export interface Product {
  id: string;
  name: string;
  entitlements: Entitlement[];
  tierDefinitions?: TierDefinition[]; // Added based on your query
}

export interface Country {
  id: string;
}

export interface TransitionOffer {
  id: string;
  name: string;
  brands: string[];
  startDate?: string; // Assuming date string
  endDate?: string; // Assuming date string
  countries: Country[];
  packageId?: string;
  package?: {
    name: string;
  };
  products: {
    id: string;
    name: string;
  }[];
  currency?: {
    // Only for OfferD2C
    code: string;
  };
}

export interface Cohort {
  id: string;
  name: string;
}

export interface Eligibility {
  includedCohorts: Cohort[];
  excludedCohorts: Cohort[];
}

export interface Transition {
  transitionOffer: TransitionOffer;
  transitionDate?: string; // Assuming date string
  transitionDateOperator?: string; // e.g., "BEFORE", "AFTER"
  transitionReason?: string;
  eligibility?: Eligibility;
}

export interface Currency {
  code: string;
}

export interface OfferProductPrice {
  retailPrice?: { amount: number };
  offerDiscount?: { discountAmount: number };
  referenceOfferProductPriceAmount?: number;
  offerProductPriceAmount?: number;
}

export interface DurationLength {
  durationLength?: number;
  durationUnit?: string; // e.g., "MONTH", "YEAR"
}

export interface DurationDate {
  endDate?: string; // Assuming date string
}

export type Duration = DurationLength | DurationDate;

export interface ProductPhase {
  id: string;
  phaseType: string;
  discount?: { discountAmount: number };
  finalPrice?: number;
  currency?: { code: string };
  isUnlimited?: boolean;
  isOneTime?: boolean;
  duration?: Duration;
  product?: {
    id: string;
    name: string;
    type: string;
    entitlements: Entitlement[];
  };
}

export interface OfferProduct {
  referenceOfferId?: string;
  productId: string;
  price?: OfferProductPrice;
  initialPhase?: ProductPhase;
}

export interface OfferD2C {
  initialPrice?: number;
  billingFrequency?: string; // e.g., "MONTHLY", "ANNUAL"
  billingType: OfferBillingType;
  currency?: Currency;
  referenceOffers?: Offer[]; // Recursive, careful with depth
  offerProducts?: OfferProduct[];
}

export type PartnerSaleType = 'REVENUE_SHARE' | 'FIXED_FEE'; // Example
export type PromoType3PP = 'COUPON' | 'BOGO'; // Example
export type PaidUpon = 'ACTIVATION' | 'RENEWAL'; // Example

export interface Offer3PP {
  partnerSaleType?: PartnerSaleType;
  promoType3PP?: PromoType3PP;
  partnerPaidAmount?: number;
  durationLength?: DurationLength;
  paidUpon?: PaidUpon;
}

export interface OfferPhaseIAP {
  id: string;
  type: string;
  phaseOrder: number;
  products: { id: string; name: string }[];
  iapDuration?: DurationLength;
}

export interface OfferIAP {
  billingFrequency?: string;
  offerPhases?: OfferPhaseIAP[];
}

// The main Offer interface, with Discriminated Unions for offer types
export type Offer = {
  __typename: 'OfferD2C' | 'Offer3PP' | 'OfferIAP'; // Discriminator
  id: string;
  name: string;
  description?: string;
  billingType: OfferBillingType;
  startDate?: string;
  endDate?: string;
  referenceLinks?: ReferenceLink[];
  packageId?: string;
  products?: Product[];
  countries?: Country[];
  createdBy?: string;
  createdDate?: string;
  status: OfferStatus;
  brands?: string[];
  updatedBy?: string;
  updatedDate?: string;
  priceType?: PriceType;
  transitions?: Transition[];
} & (OfferD2C | Offer3PP | OfferIAP);

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}
