

export type OfferBillingType = 'ONE_TIME' | 'RECURRING' | 'FREE' | 'DIRECT_BILLING';
export type PriceType = 'NET' | 'GROSS' | 'PROMO' | 'RETAIL';
export type OfferStatus = 'LIVE' | 'ACTIVE' | 'INACTIVE' | 'PENDING';

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
  endDate?: string | null;
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

export interface Currency {
  code: string;
}

export interface OfferProductPrice {
  retailPrice?: number | null;
  offerDiscount?: number | null;
  referenceOfferProductPriceAmount?: number;
  offerProductPriceAmount?: number;
}

export interface DurationLength {
  durationLength?: number;
  durationUnit?: string;
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
  currency?: Currency;
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
  __typename: 'OfferD2C';
  initialPrice: number;
  billingFrequency: string;
  billingType: OfferBillingType;
  currency: Currency;
  referenceOffers?: Offer[];
  offerProducts?: OfferProduct[];
}

export interface Offer3PP {
  __typename: 'Offer3PP';
  partnerSaleType?: PartnerSaleType;
  promoType3PP?: PromoType3PP;
  partnerPaidAmount?: number;
  durationLength?: DurationLength;
  paidUpon?: PaidUpon;
}

export interface OfferIAP {
  __typename: 'OfferIAP';
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


export type Offer = {
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