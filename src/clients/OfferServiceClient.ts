import { OfferServiceResponse } from '../model/types';

const GET_OFFERS_QUERY = `
query GetOffers($offerId: ID!) {
  offers(offerFilters: [{ offerId: $offerId}]) {
    id
    name
    offerType
    packages {
      id
      name
    }
    offerEligibility {
      cohortEligibility {
        eligibleCohorts {
          name
        }
      }
    }
    availability {
      isActive
      startDate
      endDate
    }
    legacyIds {
      dssOfferId
      huluBundleId
      huluProgramId
    }
    discounts {
      discountPrices {
        product {
          id
        }
        price {
          amount
        }
      }
    }
    products {
      offerProductType
      basePrice {
        amount
      }
      product {
        id
        name
        entitlements {
          name
        }
        legacyIds {
          dssProductId
        }
      }
      schedule {
        phases {
          id
          discounts {
            id
            type
            duration {
              unit
              length
            }
            paymentDuration {
              unit
              length
            }
            discountPrices {
              product {
                id
              }
              price {
                amount
              }
            }
          }
          phaseType
          repeatCount
          accountingType
          finalPrice
          duration {
            unit
            length
          }
        }
      }
    }
  }
}
`;

export class OfferServiceClient {
    private readonly baseUrl: string;

    constructor(environment: 'prod' | 'qa' | 'dev') {
        // Note: The environment variable is nested within the subdomain for this URL
        this.baseUrl = `http://default.offer-service.offermgmt.bamtech.${environment}.us-east-1.bamgrid.net/graphql`;
    }

    /**
     * Fetches offer data from the GraphQL service.
     * @param offerId The ID of the offer to retrieve.
     * @returns A Promise that resolves to an OfferServiceResponse object.
     * @throws Will throw an error if the network request fails or the GraphQL response contains errors.
     */
    async getOfferById(offerId: string): Promise<OfferServiceResponse> {
        const requestBody = {
            query: GET_OFFERS_QUERY,
            variables: {
                offerId: offerId,
            },
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST', // GraphQL APIs typically use POST
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // Indicate that we prefer JSON response
                    // Add any authorization headers if required by your API
                    // 'Authorization': 'Bearer YOUR_AUTH_TOKEN',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                // Handle HTTP errors (e.g., 401, 403, 500)
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorText}`);
            }

            const data: OfferServiceResponse = await response.json();

            // GraphQL responses can still return 200 OK but contain errors in the 'errors' field
            if (data.data === null || data.data.offers === null) {
                // If 'data' is null, there might be a top-level GraphQL error
                const errorData: any = data; // Cast to any to access potential errors field
                if (errorData.errors && Array.isArray(errorData.errors)) {
                    const graphQLErrors = errorData.errors.map((err: any) => err.message).join(', ');
                    throw new Error(`GraphQL errors: ${graphQLErrors}`);
                }
                throw new Error("GraphQL response 'data' field is null or 'offers' is null.");
            }


            return data;
        } catch (error) {
            console.error('Error fetching offer data:', error);
            throw error; // Re-throw to allow the caller to handle it
        }
    }
}
