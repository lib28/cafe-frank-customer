// C:\Users\blect\cafe-frank-customer\api.js
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://cafe-frank-customer.onrender.com";

// Simple helper for GET requests
export async function get(path) {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    // Try JSON, fallback to text
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("API GET failed:", err?.message || err);
    throw err;
  }
}

// One-click health check
export const pingServer = () => get("/health");
