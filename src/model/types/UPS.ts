/// UPS client types
export type BillingPeriod = 'MONTH' | 'YEAR' | 'WEEK' | 'DAY';
export type PhaseType = 'PREPAID' | 'RECURRING' | 'TRIAL';
export type DurationUnit = 'MONTH' | 'YEAR' | 'WEEK' | 'DAY';
export interface CurrencyAmount {
  amount: number;
  isoFormattedCurrency: string;
  billingPeriod: BillingPeriod | null;
}

export interface DiscountDuration {
  unit: DurationUnit | null;
  length: number;
  isoFormatted: string | null;
}

export interface PromotionalPrice {
  amount: number;
  isoFormattedCurrency: string;
  billingPeriod: BillingPeriod | null;
  phaseType: PhaseType | null;
  discountDuration: DiscountDuration | null;
  billingFrequency: number;
}

export interface PackagePrice {
  packageId: string;
  retailPrice: CurrencyAmount;
  promotionalPrices: PromotionalPrice[];
  destinationPrices: CurrencyAmount[];
}

export interface OfferPriceResponse {
  retailPrice?: CurrencyAmount;
  promotionalPrices?: PromotionalPrice[];
  destinationPrices?: CurrencyAmount[];
  packagePrices: PackagePrice[];
  error?: string;
  success?: boolean;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}
