import { health, getBaseUrl } from './base';

export async function waitForHealthy({ tries = 5, delayMs = 1200 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const h = await health();
      if (h?.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

export function logBaseUrlOnce() {
  // Call this at app init to confirm env wiring
  try {
    // eslint-disable-next-line no-console
    console.log('[API BASE]', getBaseUrl());
  } catch {}
}
