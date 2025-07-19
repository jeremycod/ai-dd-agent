// src/graphql/offerServiceQueries.ts (or a suitable directory)

/**
 * Defines the variables for the GetOfferById GraphQL query.
 */
export interface GetOfferByIdVariables {
  offerId: string;
}

/**
 * GraphQL query to retrieve detailed information for a specific offer from the Offer Service.
 * The offerId is an external parameter.
 */
export const GET_OFFER_BY_ID_QUERY = `
  query GetOfferById($offerId: ID!) { # Define the variable here
    offers(
      offerFilters: [
        {offerId: $offerId} # Use the variable here
      ]
    ) {
      id
      name
      products {
        product {
          id
        }
      }
      pricing {
        amount
        billingPeriod
        currency
        reason
        discountedDuration {
          length
          unit
        }
        freeTrialDuration {
          unit
          length
        }
        product {
          id
          name
        }
      }
      packages {
        id
        name
      }
      labels
      accountingEntity {
        id
        accountingPhases {
          accountingPhaseId
          offerPhaseId
          policies {
            duration {
              length
              unit
            }
            id
            legacyPolicyId
            repeatCount
            type
          }
        }
      }
    }
  }
`;
