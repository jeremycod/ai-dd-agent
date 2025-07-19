// Offer service client types
import { DurationUnit, PhaseType } from './UPS';

export type OfferType = 'STANDARD_TIER' | 'PROMOTIONAL_OFFER' | 'TRIAL_OFFER' | 'MIGRATION_OFFER'; // Extend as needed
export type OfferProductType = 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'WEEKLY' | 'DAILY'; // Extend as needed
//export type PhaseType = 'FULL_PRICE' | 'DISCOUNT' | 'TRIAL'; // Extend as needed
export type AccountingType = 'USER_PAID' | 'COMPLIMENTARY'; // Extend as needed
//export type DurationUnit = 'MONTH' | 'YEAR' | 'WEEK' | 'DAY'; // Re-using from previous example, assuming consistency
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'; // Common discount types, extend as needed

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
  discounts: Discount[]; // Top-level discounts, if any (your example shows empty array)
  products: OfferProduct[];
}

// Overall response structure
export interface OfferServiceResponse {
  data?: {
    offers: Offer[];
  };
  error?: string;
  // You might also want to add a 'success' boolean to make it clearer
  success?: boolean;
  // For GraphQL errors, maybe a specific errors array
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}
