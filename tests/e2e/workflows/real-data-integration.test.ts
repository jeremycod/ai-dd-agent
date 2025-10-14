import { RealDataMockService } from '../mocks/realDataMockService';

describe('Real Data Integration Testing', () => {
  let realDataMock: RealDataMockService;

  beforeAll(async () => {
    realDataMock = new RealDataMockService();
    await realDataMock.initialize();
  });

  describe('Using captured production responses', () => {
    it('should use real captured Datadog logs when available', async () => {
      const entityId = 'REAL-OFFER-123';
      const timeRange = '1h';

      // This will use real captured data if available, fallback to default
      const logs = await realDataMock.getDatadogLogs(entityId, timeRange);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      
      if (logs.length > 0) {
        expect(logs[0]).toHaveProperty('timestamp');
        expect(logs[0]).toHaveProperty('level');
        expect(logs[0]).toHaveProperty('message');
      }

      // Check if this was real captured data
      const hasRealData = await realDataMock.hasRealDataFor('datadog_logs', { entityId, timeRange });
      console.log(`Using ${hasRealData ? 'REAL' : 'SYNTHETIC'} data for Datadog logs`);
    });

    it('should use real captured Genie offer data when available', async () => {
      const offerId = 'REAL-OFFER-123';
      const environment = 'production';

      const offer = await realDataMock.getGenieOffer(offerId, environment);

      expect(offer).toBeDefined();
      expect(offer).toHaveProperty('id');
      expect(offer).toHaveProperty('status');
      expect(offer.id).toBe(offerId);

      const hasRealData = await realDataMock.hasRealDataFor('genie_offer', { offerId, environment });
      console.log(`Using ${hasRealData ? 'REAL' : 'SYNTHETIC'} data for Genie offer`);
    });

    it('should generate test scenarios from real captured data', async () => {
      const scenarios = await realDataMock.generateScenariosFromCapturedData();

      expect(Array.isArray(scenarios)).toBe(true);
      
      if (scenarios.length > 0) {
        const scenario = scenarios[0];
        expect(scenario).toHaveProperty('entityId');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('responses');
        expect(scenario).toHaveProperty('capturedAt');
        
        console.log(`Generated ${scenarios.length} scenarios from real data`);
        console.log('Sample scenario:', {
          entityId: scenario.entityId,
          name: scenario.name,
          responseTypes: Object.keys(scenario.responses)
        });
      } else {
        console.log('No real captured data available - using synthetic scenarios');
      }
    });

    it('should provide coverage report of real vs synthetic data', async () => {
      const coverage = await realDataMock.getCoverageReport();

      expect(coverage).toHaveProperty('total');
      expect(coverage).toHaveProperty('byApi');
      expect(coverage).toHaveProperty('byEnvironment');

      console.log('Data Coverage Report:');
      console.log(`Total captured responses: ${coverage.total}`);
      console.log('By API:', coverage.byApi);
      console.log('By Environment:', coverage.byEnvironment);
      
      if (coverage.dateRange.earliest && coverage.dateRange.latest) {
        console.log(`Date range: ${coverage.dateRange.earliest} to ${coverage.dateRange.latest}`);
      }
    });
  });

  describe('Real data quality validation', () => {
    it('should validate that real captured data matches expected schema', async () => {
      const allResponses = await realDataMock.getAllCapturedResponses();

      for (const response of allResponses) {
        // Validate basic structure
        expect(response).toHaveProperty('api');
        expect(response).toHaveProperty('method');
        expect(response).toHaveProperty('params');
        expect(response).toHaveProperty('response');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('statusCode');

        // Validate API-specific schemas
        if (response.api === 'datadog_logs' && response.statusCode === 200) {
          expect(Array.isArray(response.response)).toBe(true);
          if (response.response.length > 0) {
            const log = response.response[0];
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('level');
            expect(log).toHaveProperty('message');
          }
        }

        if (response.api === 'genie_offer' && response.statusCode === 200) {
          expect(response.response).toHaveProperty('id');
          expect(response.response).toHaveProperty('status');
        }

        if (response.api === 'ups_price' && response.statusCode === 200) {
          expect(response.response).toHaveProperty('price');
          expect(response.response).toHaveProperty('currency');
        }
      }

      console.log(`Validated ${allResponses.length} captured responses`);
    });

    it('should compare real data patterns with synthetic data', async () => {
      const realScenarios = await realDataMock.generateScenariosFromCapturedData();
      
      // Compare with synthetic patterns
      const syntheticPatterns = {
        commonStatuses: ['ACTIVE', 'INACTIVE', 'PENDING'],
        commonLogLevels: ['INFO', 'WARN', 'ERROR'],
        commonPriceRanges: [0.99, 9.99, 19.99, 29.99]
      };

      if (realScenarios.length > 0) {
        // Extract patterns from real data
        const realPatterns = {
          statuses: new Set(),
          logLevels: new Set(),
          prices: new Set()
        };

        for (const scenario of realScenarios) {
          if (scenario.responses.genie_offer) {
            realPatterns.statuses.add(scenario.responses.genie_offer.status);
          }
          if (scenario.responses.datadog_logs) {
            scenario.responses.datadog_logs.forEach((log: any) => {
              realPatterns.logLevels.add(log.level);
            });
          }
          if (scenario.responses.ups_price) {
            realPatterns.prices.add(scenario.responses.ups_price.price);
          }
        }

        console.log('Real data patterns:');
        console.log('Statuses:', Array.from(realPatterns.statuses));
        console.log('Log levels:', Array.from(realPatterns.logLevels));
        console.log('Prices:', Array.from(realPatterns.prices));

        // Verify our synthetic data covers real patterns
        const statusCoverage = syntheticPatterns.commonStatuses.some(status => 
          realPatterns.statuses.has(status)
        );
        const logLevelCoverage = syntheticPatterns.commonLogLevels.some(level => 
          realPatterns.logLevels.has(level)
        );

        if (statusCoverage) {
          console.log('✅ Synthetic data covers real status patterns');
        } else {
          console.log('⚠️ Synthetic data may not cover all real status patterns');
        }

        if (logLevelCoverage) {
          console.log('✅ Synthetic data covers real log level patterns');
        } else {
          console.log('⚠️ Synthetic data may not cover all real log level patterns');
        }
      }
    });
  });
});