// src/api/base.js
export function getBaseUrl() {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  if (!url) {
    console.log('[API BASE] defaulting to http://localhost:3000');
    return 'http://localhost:3000';
  }
  console.log('[API BASE]', url);
  return url.replace(/\/+$/, '');
}

// --- SHIMS for legacy code (avoid undefined fn crashes) ---
export const getApiBaseReady = getBaseUrl; // old code called this
export const initBaseUrl = () => {};       // no longer needed, keep noop
export const BASE_URL = getBaseUrl();      // if something imported a constant
