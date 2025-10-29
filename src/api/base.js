// src/api/base.js
const raw = process.env.EXPO_PUBLIC_API_URL || "https://cafe-frank-customer.onrender.com";
const normalize = (u) => (u ? String(u).replace(/\/+$/, "") : u);

export let BASE_URL = normalize(raw);

export const setBaseUrl = (u) => {
  BASE_URL = normalize(u);
  if (__DEV__) console.log("[API] BASE_URL set to:", BASE_URL);
};

export const getBaseUrl = () => BASE_URL;

export const initBaseUrl = async () => {
  if (__DEV__) console.log("[API] initBaseUrl ->", BASE_URL);
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const text = await res.text();
    if (__DEV__) console.log("[API] /health OK:", text);
  } catch (e) {
    console.warn("[API] Health check failed:", String(e?.message || e));
  }
};
