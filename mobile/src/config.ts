export const config = {
  // Centralized backend endpoint used by both Android and iOS
  apiUrl: process.env.API_URL || 'http://localhost:4000/api',
  androidEmulatorApiUrl: 'http://10.0.2.2:4000/api',
  appName: 'AQ Companies Logistics & Banking',
  version: '1.0.0',
  buildNumber: 1,
  appId: 'com.aqcompanies.system',
  tokenStorageKey: 'aq_companies_mobile_token',
  sessionTimeoutMs: 3600000 // 1 hour
};
