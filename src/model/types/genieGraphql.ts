// src/model/types/genieService.ts

export type OfferBillingType = 'ONE_TIME' | 'RECURRING' | 'FREE' | 'DIRECT_BILLING'; // Added DIRECT_BILLING
export type PriceType = 'NET' | 'GROSS' | 'PROMO' | 'RETAIL'; // Added PROMO, RETAIL
export type OfferStatus = 'LIVE' | 'ACTIVE' | 'INACTIVE' | 'PENDING'; // Added LIVE

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

export interface Product { // This is the Genie Product
  id: string;
  name: string;
  entitlements: Entitlement[];
  tierDefinitions?: TierDefinition[];
}

export interface Country {
  id: string;
}

export interface TransitionOffer {
  id: string;
  name: string;
  brands: string[];
  startDate?: string;
  endDate?: string | null; // Added null
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
  transitionDate?: string;
  transitionDateOperator?: string;
  transitionReason?: string;
  eligibility?: Eligibility;
}

export interface Currency { // Genie specific currency interface
  code: string;
}

export interface OfferProductPrice {
  retailPrice?: number | null; // Simplified based on your Genie JSON having null or number
  offerDiscount?: number | null; // Simplified
  referenceOfferProductPriceAmount?: number;
  offerProductPriceAmount?: number;
}

export interface DurationLength {
  durationLength?: number;
  durationUnit?: string; // e.g., "MONTH", "YEAR" - note: this is different from OfferService's DurationUnit
}

export interface DurationDate {
  endDate?: string;
}

export type Duration = DurationLength | DurationDate;

export interface ProductPhase {
  id: string;
  phaseType: string;
  discount?: { discountAmount: number };
  finalPrice?: number;
  currency?: Currency; // Using Genie's Currency
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

export interface OfferProduct { // This is the Genie's OfferProduct
  referenceOfferId?: string;
  productId: string;
  price?: OfferProductPrice;
  initialPhase?: ProductPhase;
}

// These are the specific discriminated union types
export interface OfferD2C {
  __typename: 'OfferD2C'; // Explicit discriminator for OfferD2C
  initialPrice: number; // Required based on your JSON
  billingFrequency: string; // Required based on your JSON
  billingType: OfferBillingType;
  currency: Currency; // Required based on your JSON
  referenceOffers?: Offer[];
  offerProducts?: OfferProduct[];
}

export interface Offer3PP {
  __typename: 'Offer3PP'; // Explicit discriminator
  partnerSaleType?: PartnerSaleType;
  promoType3PP?: PromoType3PP;
  partnerPaidAmount?: number;
  durationLength?: DurationLength;
  paidUpon?: PaidUpon;
}

export interface OfferIAP {
  __typename: 'OfferIAP'; // Explicit discriminator
  billingFrequency?: string;
  offerPhases?: OfferPhaseIAP[];
}

export type PartnerSaleType = 'REVENUE_SHARE' | 'FIXED_FEE';
export type PromoType3PP = 'COUPON' | 'BOGO';
export type PaidUpon = 'ACTIVATION' | 'RENEWAL';

export interface OfferPhaseIAP {
  id: string;
  type: string;
  phaseOrder: number;
  products: { id: string; name: string }[];
  iapDuration?: DurationLength;
}


// The main Genie Offer interface, as a Discriminated Union
export type Offer = { // Exported as 'GenieOffer'
  id: string;
  name: string;
  description?: string;
  billingType: OfferBillingType;
  startDate?: string;
  endDate?: string;
  referenceLinks?: ReferenceLink[];
  packageId?: string;
  products?: Product[]; // Array of Genie's Product type
  countries?: Country[];
  createdBy?: string;
  createdDate?: string;
  status: OfferStatus;
  brands?: string[];
  updatedBy?: string;
  updatedDate?: string;
  priceType?: PriceType;
  transitions?: Transition[];
} & (OfferD2C | Offer3PP | OfferIAP); // The discriminated union part

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}