import { ApiCaptureWrapper } from '../../../src/services/apiCaptureWrapper';

describe('API Capture Integration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CAPTURE_API_RESPONSES;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CAPTURE_API_RESPONSES = originalEnv;
    } else {
      delete process.env.CAPTURE_API_RESPONSES;
    }
  });

  it('should not capture when CAPTURE_API_RESPONSES is not set', () => {
    delete process.env.CAPTURE_API_RESPONSES;
    
    const wrapper = new ApiCaptureWrapper();
    expect(wrapper.isCapturing()).toBe(false);
  });

  it('should not capture when CAPTURE_API_RESPONSES is false', () => {
    process.env.CAPTURE_API_RESPONSES = 'false';
    
    const wrapper = new ApiCaptureWrapper();
    expect(wrapper.isCapturing()).toBe(false);
  });

  it('should capture when CAPTURE_API_RESPONSES is true', () => {
    process.env.CAPTURE_API_RESPONSES = 'true';
    
    const wrapper = new ApiCaptureWrapper();
    expect(wrapper.isCapturing()).toBe(true);
  });

  it('should wrap API calls when capture is enabled', async () => {
    process.env.CAPTURE_API_RESPONSES = 'true';
    
    const wrapper = new ApiCaptureWrapper();
    
    // Mock API function
    const mockApiCall = jest.fn().mockResolvedValue(['mock', 'data']);
    
    // Call wrapped function
    const result = await wrapper.wrapDatadogCall(mockApiCall, 'test-entity', '1h');
    
    expect(mockApiCall).toHaveBeenCalled();
    expect(result).toEqual(['mock', 'data']);
  });

  it('should pass through API calls when capture is disabled', async () => {
    process.env.CAPTURE_API_RESPONSES = 'false';
    
    const wrapper = new ApiCaptureWrapper();
    
    // Mock API function
    const mockApiCall = jest.fn().mockResolvedValue(['mock', 'data']);
    
    // Call wrapped function
    const result = await wrapper.wrapDatadogCall(mockApiCall, 'test-entity', '1h');
    
    expect(mockApiCall).toHaveBeenCalled();
    expect(result).toEqual(['mock', 'data']);
  });

  it('should demonstrate usage pattern for service integration', async () => {
    // Example of how to integrate with existing services
    class MockDatadogService {
      private captureWrapper = new ApiCaptureWrapper();

      async getLogs(entityId: string, timeRange?: string): Promise<any[]> {
        const originalCall = async () => {
          // Simulate actual API call
          return [
            {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: `Log for ${entityId}`,
              service: 'test-service'
            }
          ];
        };

        // Wrap with capture if enabled
        return await this.captureWrapper.wrapDatadogCall(originalCall, entityId, timeRange);
      }
    }

    // Test with capture enabled
    process.env.CAPTURE_API_RESPONSES = 'true';
    const service = new MockDatadogService();
    const logs = await service.getLogs('test-entity', '1h');
    
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('test-entity');
  });
});