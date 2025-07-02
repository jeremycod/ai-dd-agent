import {
  analyzeDatadogErrorsTool,
  getMockDatadogLogsTool,
  analyzeDatadogWarningsTool,
} from './datadogLogsTool';

export const allTools = [getMockDatadogLogsTool, analyzeDatadogErrorsTool];
