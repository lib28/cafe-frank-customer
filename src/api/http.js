// src/api/http.js
import { getBaseUrl } from "./base";

const fetchJson = async (path, { method = "GET", body, timeoutMs = 9000, headers = {} } = {}) => {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${typeof data === "string" ? data : data?.error || ""}`);
    return data;
  } finally {
    clearTimeout(t);
  }
};

export const getUser = () => fetchJson("/api/user");
export const saveUser = (payload) => fetchJson("/api/user", { method: "PUT", body: payload });
export const createOrder = (payload) => fetchJson("/api/orders", { method: "POST", body: payload });
export const getMenu = () => fetchJson("/api/menu");
