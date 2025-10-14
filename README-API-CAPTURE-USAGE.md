# API Capture Usage Guide

## Quick Start

### Option 1: Use npm script (Recommended)
```bash
npm run dev:capture
```

### Option 2: Use shell script
```bash
./start-with-capture.sh
```

### Option 3: Manual setup
```bash
export CAPTURE_API_RESPONSES=true
export PORT=3005
npm run dev:noauth
```

## Testing API Capture

Once the server is running, test the endpoints:

### Health Check
```bash
curl http://localhost:3005/health
```

### Test API Capture with Diagnose Endpoint
```bash
curl -X POST http://localhost:3005/api/diagnose \
  -H "Content-Type: application/json" \
  -d '{"query": "Why is offer ABC-123 not working?", "entityId": "ABC-123"}'
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:3005/chat \
  -H "Content-Type: application/json" \
  -d '{"userQuery": "Check offer ABC-123 status"}'
```

## Verify Captured Responses

Check if responses were captured:
```bash
ls -la tests/e2e/fixtures/captured-responses/
```

## What Gets Captured

When `CAPTURE_API_RESPONSES=true`, the server will:

1. **Mock API calls** - The serverNoAuth.ts uses mock functions that simulate real API calls
2. **Capture responses** - All mock responses are saved to JSON files
3. **Store in fixtures** - Files are saved to `tests/e2e/fixtures/captured-responses/`
4. **Use for testing** - Captured responses can be used in E2E tests

## Captured File Format

Example captured response:
```json
{
  "api": "datadog_logs",
  "method": "GET", 
  "url": "/api/v2/logs/search",
  "params": {
    "entityId": "ABC-123",
    "timeRange": "1h"
  },
  "response": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "level": "INFO",
      "message": "Diagnostic log for entity ABC-123",
      "service": "diagnostic-service",
      "tags": ["entity_id:ABC-123", "environment:production"]
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z",
  "statusCode": 200
}
```

## Troubleshooting

### Port Already in Use
If you get `EADDRINUSE` error, change the port:
```bash
export PORT=3006
npm run dev:noauth
```

### Server Not Responding
1. Check if server started successfully
2. Verify the port is correct
3. Test with curl commands above
4. Check server logs for errors

### No Responses Captured
1. Verify `CAPTURE_API_RESPONSES=true` is set
2. Make API calls to trigger capture
3. Check the capture directory exists
4. Look for console messages about capture

## Integration with Real APIs

To capture real production API responses (not mocks):

1. Modify the actual API service files to use `ApiCaptureWrapper`
2. Run in staging environment with real API credentials
3. Execute typical user scenarios
4. Captured responses will contain real production data

See `doc/testing/real-data-capture-guide.md` for detailed implementation.