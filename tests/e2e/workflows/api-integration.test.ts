import { ApiMockService } from '../mocks/apiMockService';

describe('API Integration Testing with Mocked External Services', () => {
  let apiMock: ApiMockService;

  beforeEach(() => {
    apiMock = new ApiMockService();
  });

  afterEach(() => {
    apiMock.clearMocks();
  });

  describe('fetchParallelData with mocked APIs', () => {
    it('should fetch data from all external APIs for offer diagnosis', async () => {
      const offerId = 'ABC-123';
      const environment = 'production';

      // Setup mock responses for all APIs
      apiMock.setupOfferStatusScenario(offerId, environment);

      // Simulate fetchParallelData execution
      const mockFetchParallelData = async (entityIds: string[], env: string) => {
        const results = await Promise.allSettled([
          apiMock.getDatadogLogs(entityIds[0]),
          apiMock.getGenieOffer(entityIds[0], env),
          apiMock.getEntityHistory(entityIds[0], 'offer')
        ]);

        return {
          datadogLogs: results[0].status === 'fulfilled' ? results[0].value : [],
          genieOffer: results[1].status === 'fulfilled' ? results[1].value : null,
          entityHistory: results[2].status === 'fulfilled' ? results[2].value : []
        };
      };

      // Execute the mocked parallel data fetch
      const result = await mockFetchParallelData([offerId], environment);

      // Verify all APIs were called
      expect(apiMock.getCallCount('datadog_logs')).toBe(1);
      expect(apiMock.getCallCount('genie_offer')).toBe(1);
      expect(apiMock.getCallCount('entity_history')).toBe(1);

      // Verify data structure
      expect(result.datadogLogs).toHaveLength(1);
      expect(result.datadogLogs[0].level).toBe('ERROR');
      expect(result.datadogLogs[0].message).toContain(offerId);

      expect(result.genieOffer).toBeDefined();
      expect(result.genieOffer.id).toBe(offerId);
      expect(result.genieOffer.status).toBe('INACTIVE');

      expect(result.entityHistory).toHaveLength(1);
      expect(result.entityHistory[0].changes.status.to).toBe('INACTIVE');
    });

    it('should handle pricing scenario with multiple APIs', async () => {
      const offerId = 'XYZ-789';
      const environment = 'staging';

      // Setup pricing scenario
      apiMock.setupPricingScenario(offerId, environment);

      // Simulate pricing-specific data fetch
      const mockFetchPricingData = async (entityId: string, env: string) => {
        const results = await Promise.allSettled([
          apiMock.getUPSOfferPrice(entityId, env),
          apiMock.getGenieOffer(entityId, env)
        ]);

        return {
          upsPrice: results[0].status === 'fulfilled' ? results[0].value : null,
          genieOffer: results[1].status === 'fulfilled' ? results[1].value : null
        };
      };

      const result = await mockFetchPricingData(offerId, environment);

      // Verify pricing data
      expect(result.upsPrice).toBeDefined();
      expect(result.upsPrice.price).toBe(9.99);
      expect(result.upsPrice.currency).toBe('USD');

      expect(result.genieOffer).toBeDefined();
      expect(result.genieOffer.pricing.basePrice).toBe(9.99);

      // Verify API calls
      expect(apiMock.getCallCount('ups_price')).toBe(1);
      expect(apiMock.getCallCount('genie_offer')).toBe(1);
    });

    it('should handle API errors gracefully', async () => {
      const offerId = 'ERROR-123';
      const environment = 'production';

      // Setup error scenarios
      apiMock.mockApiError(`datadog_logs_${offerId}`, 'Rate limit exceeded');
      apiMock.mockApiError(`genie_offer_${offerId}`, 'Service unavailable');

      // Simulate error handling in fetchParallelData
      const mockFetchWithErrorHandling = async (entityId: string, env: string) => {
        const results = await Promise.allSettled([
          apiMock.getDatadogLogs(entityId).catch(err => ({ error: err.message })),
          apiMock.getGenieOffer(entityId, env).catch(err => ({ error: err.message })),
          apiMock.getEntityHistory(entityId, 'offer') // This should succeed
        ]);

        return {
          datadogLogs: results[0].status === 'fulfilled' ? results[0].value : null,
          genieOffer: results[1].status === 'fulfilled' ? results[1].value : null,
          entityHistory: results[2].status === 'fulfilled' ? results[2].value : []
        };
      };

      const result = await mockFetchWithErrorHandling(offerId, environment);

      // Verify error handling
      expect(result.datadogLogs).toEqual({ error: 'Rate limit exceeded' });
      expect(result.genieOffer).toEqual({ error: 'Service unavailable' });
      expect(result.entityHistory).toEqual([]); // Should succeed with empty array

      // Verify all APIs were attempted
      expect(apiMock.getCallCount()).toBe(3);
    });

    it('should simulate realistic API latencies', async () => {
      const offerId = 'LATENCY-TEST';
      const environment = 'production';

      // Setup scenario with different latencies
      apiMock.setupOfferStatusScenario(offerId, environment);

      const startTime = Date.now();

      // Execute parallel calls (should run concurrently)
      const results = await Promise.all([
        apiMock.getDatadogLogs(offerId),      // 150ms latency
        apiMock.getGenieOffer(offerId, environment), // 200ms latency
        apiMock.getEntityHistory(offerId, 'offer')   // 100ms latency
      ]);

      const totalTime = Date.now() - startTime;

      // Should take approximately the time of the slowest API (200ms) + some overhead
      // Not the sum of all latencies (450ms) since they run in parallel
      expect(totalTime).toBeGreaterThanOrEqual(200);
      expect(totalTime).toBeLessThan(350); // Allow for more overhead

      // Verify all results are present
      expect(results[0]).toHaveLength(1); // Datadog logs
      expect(results[1]).toBeDefined();   // Genie offer
      expect(results[2]).toHaveLength(1); // Entity history
    });

    it('should validate API call parameters', async () => {
      const offerId = 'PARAM-TEST';
      const environment = 'staging';
      const timeRange = '1h';

      apiMock.setupOfferStatusScenario(offerId, environment);

      // Make calls with specific parameters
      await apiMock.getDatadogLogs(offerId, timeRange);
      await apiMock.getGenieOffer(offerId, environment);
      await apiMock.getEntityHistory(offerId, 'offer');

      // Verify call parameters
      const callLog = apiMock.getCallLog();
      
      const datadogCall = callLog.find(call => call.api === 'datadog_logs');
      expect(datadogCall?.params).toEqual({ entityId: offerId, timeRange });

      const genieCall = callLog.find(call => call.api === 'genie_offer');
      expect(genieCall?.params).toEqual({ offerId, environment });

      const historyCall = callLog.find(call => call.api === 'entity_history');
      expect(historyCall?.params).toEqual({ entityId: offerId, entityType: 'offer' });
    });
  });

  describe('Tool response analysis', () => {
    it('should analyze combined tool responses for diagnosis', async () => {
      const offerId = 'ANALYSIS-123';
      const environment = 'production';

      // Setup comprehensive scenario
      apiMock.setupOfferStatusScenario(offerId, environment);

      // Fetch all data
      const toolResponses = {
        datadogLogs: await apiMock.getDatadogLogs(offerId),
        genieOffer: await apiMock.getGenieOffer(offerId, environment),
        entityHistory: await apiMock.getEntityHistory(offerId, 'offer')
      };

      // Mock analysis of combined responses
      const mockAnalyzeToolResponses = (responses: any) => {
        const analysis = {
          rootCause: 'unknown',
          confidence: 0.5,
          recommendations: [] as string[]
        };

        // Analyze Datadog logs
        if (responses.datadogLogs?.some((log: any) => log.level === 'ERROR')) {
          analysis.rootCause = 'configuration_error';
          analysis.confidence += 0.3;
          analysis.recommendations.push('Check offer configuration');
        }

        // Analyze Genie offer status
        if (responses.genieOffer?.status === 'INACTIVE') {
          analysis.confidence += 0.2;
          analysis.recommendations.push('Reactivate offer in Genie');
        }

        // Analyze entity history
        if (responses.entityHistory?.some((h: any) => h.changes?.status?.to === 'INACTIVE')) {
          analysis.confidence += 0.2;
          analysis.recommendations.push('Review recent status changes');
        }

        return analysis;
      };

      const analysis = mockAnalyzeToolResponses(toolResponses);

      // Verify analysis results
      expect(analysis.rootCause).toBe('configuration_error');
      expect(analysis.confidence).toBeGreaterThan(0.8);
      expect(analysis.recommendations).toContain('Check offer configuration');
      expect(analysis.recommendations).toContain('Reactivate offer in Genie');
      expect(analysis.recommendations).toContain('Review recent status changes');
    });
  });
});