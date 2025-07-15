export const GET_OFFER_QUERY = `
  query GetOffer($offerId: ID!) {
    offer(id: $offerId) {
      __typename
      id
      name
      description
      billingType
      startDate
      endDate
      referenceLinks {
        key
        url
      }
      packageId
      products {
        id
        name
        entitlements {
          id
          name
        }
        tierDefinitions {
          countryIds
          entitlementTierDefinitions {
            entitlement {
              id
              type
              values {
                default
                enumerations
                max
                min
              }
            }
          }
        }
      }
      countries {
        id
      }
      createdBy
      createdDate
      status
      brands
      updatedBy
      updatedDate
      priceType
      packageId
      transitions {
        transitionOffer {
          id
          name
          brands
          startDate
          endDate
          countries {
            id
          }
          packageId
          package {
            name
          }
          products {
            id
            name
          }
          ... on OfferD2C {
            currency {
              code
            }
          }
        }
        transitionDate
        transitionDateOperator
        transitionReason
        eligibility {
          includedCohorts {
            ... on Cohort {
              id
              name
            }
          }
          excludedCohorts {
            ... on Cohort {
              id
              name
            }
          }
        }
      }
      ... on OfferD2C {
        initialPrice
        billingFrequency
        billingType
        currency {
          code
        }
        referenceOffers {
          id
          name
          billingType
          startDate
          endDate
          referenceLinks {
            key
            url
          }
          products {
            id
            name
            entitlements {
              id
              name
            }
          }
          countries {
            id
          }
          createdBy
          createdDate
          status
          brands
          priceType
        }
        offerProducts {
          referenceOfferId
          productId
          price {
            retailPrice {
              amount
            }
            offerDiscount {
              discountAmount
            }
            referenceOfferProductPriceAmount
            offerProductPriceAmount
          }
          initialPhase {
            id
            phaseType
            discount {
              discountAmount
            }
            finalPrice
            currency {
              code
            }
            isUnlimited
            isOneTime
            duration {
              ... on DurationLength {
                durationLength
                durationUnit
              }
              ... on DurationDate {
                endDate
              }
            }
            product {
              id
              name
              type
              entitlements {
                id
                name
              }
            }
          }
        }
      }
      ... on Offer3PP {
        partnerSaleType
        promoType3PP
        partnerPaidAmount
        durationLength {
          durationLength
          durationUnit
        }
        paidUpon
      }
      ... on OfferIAP {
        billingFrequency
        offerPhases {
          id
          type
          phaseOrder
          products {
            id
            name
          }
          iapDuration: duration {
            ... on DurationLength {
              durationLength
              durationUnit
            }
          }
        }
      }
    }
  }
`;
