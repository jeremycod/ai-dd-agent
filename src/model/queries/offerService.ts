


export interface GetOfferByIdVariables {
  offerId: string;
}


export const GET_OFFER_BY_ID_QUERY = `
  query GetOfferById($offerId: ID!) {
    offers(
      offerFilters: [
        {offerId: $offerId}
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
