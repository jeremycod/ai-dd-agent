// src/model/types/offerService.ts

// Offer service client types

export type OfferType = 'STANDARD_TIER' | 'PROMOTIONAL_OFFER' | 'TRIAL_OFFER' | 'MIGRATION_OFFER'; // Extend as needed
export type OfferProductType = 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'WEEKLY' | 'DAILY'; // Extend as needed
export type AccountingType = 'USER_PAID' | 'COMPLIMENTARY'; // Extend as needed
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'; // Common discount types, extend as needed

// !!! IMPORTANT: Define DurationUnit ONCE here if this is its canonical definition for OfferService !!!
export type DurationUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'; // Canonical definition for OfferService

// PhaseType for Schedule.phases (different from Pricing.PhaseType if it exists)
export type PhaseType = 'PREPAID' | 'RECURRING' | 'TRIAL';

// New types needed for Pricing based on your JSON example and latest requirements
export type BillingPeriod = DurationUnit | null; // BillingPeriod is now of type DurationUnit or null
export type Currency = string; // Currency is now a general string
export type Reason =
    | "NO_CHANGE"
    | "PRICE_CHANGE"
    | "PROMOTION_EXPIRATION"
    | "LEGAL_COMPLIANCE"
    | "MLB_SEASON_END"
    | "STUDENT_EXPIRED"
    | null; // Can also be null

export interface DiscountedDuration {
  length: number;
  unit: DurationUnit; // Uses the canonical DurationUnit
}

// Your JSON shows 'freeTrialDuration' as null, so keeping it as null for strictness
export interface FreeTrialDuration { // Re-defined as an actual interface if it could have structure
  length: number;
  unit: DurationUnit;
}


export interface Pricing {
  amount: number;
  billingPeriod: BillingPeriod;
  currency: Currency;
  reason: Reason;
  discountedDuration: DiscountedDuration | null;
  freeTrialDuration: FreeTrialDuration | null; // Set to null based on your JSON example
  product: []; // Explicitly empty array based on your JSON
}


// --- 3. Define Interfaces for GraphQL Response Structure ---

// Reusable basic types
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


// Nested interfaces
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
  startDate: string; // ISO 8601 Date string
  endDate: string; // ISO 8601 Date string
}

export interface DiscountPrice {
  product: ProductId;
  price: PriceAmount;
}

export interface Discount {
  id: string;
  type: DiscountType; // Assuming a type for the discount itself
  duration: Duration | null;
  paymentDuration: Duration | null;
  discountPrices: DiscountPrice[];
}

export interface Phase {
  id: string;
  discounts: Discount[];
  phaseType: PhaseType; // Uses the PhaseType for Schedule
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

// The main Offer interface for Offer Service
export interface Offer { // This is the OfferService Offer
  id: string;
  name: string;
  offerType: OfferType;
  packages: OfferPackage[];
  offerEligibility: OfferEligibility;
  availability: Availability;
  legacyIds: LegacyIds;
  discounts: Discount[];
  products: OfferProduct[];
  pricing: Pricing[]; // <--- ADDED based on your JSON
  labels: string[]; // <--- ADDED based on your JSON
  accountingEntity: null; // <--- ADDED based on your JSON
}

// Overall response structure
export interface OfferServiceResponse {
  data?: {
    offers: Offer[];
  };
  error?: string;
  success?: boolean;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}