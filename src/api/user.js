// src/api/user.js
import { api } from './base';

/**
 * Try a list of candidate endpoints until one works.
 * Helps when server path is /users/me on some envs and /profile on others.
 */
async function tryEndpoints({ method = 'GET', paths = [], body }) {
  let lastErr;
  for (const path of paths) {
    try {
      const url = path.startsWith('/') ? path : `/${path}`;
      const res = await api[method.toLowerCase()](url, body);
      return { ok: true, path: url, data: res };
    } catch (e) {
      console.warn(`[PROFILE API] ${method} ${path} -> ${e.message || e}`);
      lastErr = e;
    }
  }
  const err = new Error(lastErr?.message || 'All profile endpoints failed');
  err.cause = lastErr;
  throw err;
}

export async function fetchProfile() {
  const candidates = [
    '/users/me',
    '/user/me',
    '/profile',
    '/me',
  ];
  const { data, path } = await tryEndpoints({ method: 'GET', paths: candidates });
  console.log('[PROFILE API] fetched from', path);
  return data;
}

export async function saveProfile(payload) {
  // ensure a compact JSON shape the server expects
  const clean = {
    name: payload?.name ?? '',
    email: payload?.email ?? '',
    phone: payload?.phone ?? '',
    address: payload?.address ?? '',
  };

  const putCandidates = ['/users/me', '/user/me', '/profile', '/me'];
  const postCandidates = ['/users', '/user', '/profile'];

  try {
    // Prefer PUT to an existing resource
    const { data, path } = await tryEndpoints({ method: 'PUT', paths: putCandidates, body: clean });
    console.log('[PROFILE API] saved via PUT', path);
    return data;
  } catch (e) {
    console.warn('[PROFILE API] PUT paths failed, trying POST…');
    const { data, path } = await tryEndpoints({ method: 'POST', paths: postCandidates, body: clean });
    console.log('[PROFILE API] saved via POST', path);
    return data;
  }
}
