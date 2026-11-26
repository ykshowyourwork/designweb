// FatSecret Platform API (Premier Free: search, autocomplete, barcode, US data).
// Uses OAuth 1.0 signed requests, which need no IP whitelist (OAuth 2.0 does, and Vercel has no fixed IP).
// Env: FATSECRET_CONSUMER_KEY, FATSECRET_CONSUMER_SECRET (REST API OAuth 1.0 Credentials on platform.fatsecret.com).
// Attribution: every screen that shows this data says "Powered by fatsecret" with a link (their policy).
import { createHmac, randomBytes } from "node:crypto";
import { HttpError } from "./_core.js";

const URL_ = "https://platform.fatsecret.com/rest/server.api";
const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** Signs and sends one FatSecret method call. Returns the parsed JSON. */
export async function call(method, params = {}, o = {}) {
  const env = o.env ?? process.env, fetchImpl = o.fetchImpl ?? fetch;
  const key = env.FATSECRET_CONSUMER_KEY, secret = env.FATSECRET_CONSUMER_SECRET;
  if (!key || !secret) throw new HttpError(503, "Food data isn't connected yet (FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET).");
  const p = {
    ...params, method, format: "json",
    oauth_consumer_key: key, oauth_nonce: randomBytes(12).toString("hex"), oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000), oauth_version: "1.0",
  };
  const norm = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const base = ["POST", enc(URL_), enc(norm)].join("&");
  p.oauth_signature = createHmac("sha1", `${enc(secret)}&`).update(base).digest("base64");
  const body = Object.keys(p).map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const res = await fetchImpl(URL_, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    const code = data.error.code;
    if (code === 106 || code === 211) return null; // no match (bad id / barcode not found)
    throw new HttpError(502, `Food data error: ${data.error.message || code}`);
  }
  return data;
}

const n = (v) => (v == null || v === "" ? null : Math.round(parseFloat(v) * 10) / 10);
const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);

/** "Per 1 cup - Calories: 130kcal | Fat: 0.00g | Carbs: 9.00g | Protein: 23.00g" → numbers. */
export function parseDescription(d = "") {
  const m = (re) => n(d.match(re)?.[1]);
  return { serving: (d.match(/^Per\s+(.+?)\s+-/i)?.[1] || "").trim(), kcal: m(/Calories:\s*([\d.]+)/i), fat: m(/Fat:\s*([\d.]+)/i), carbs: m(/Carbs:\s*([\d.]+)/i), protein: m(/Protein:\s*([\d.]+)/i) };
}

/** Food search: up to 20 foods with per-serving macros. */
export async function search(q, o) {
  const query = String(q ?? "").trim().slice(0, 80);
  if (query.length < 2) return { foods: [] };
  const d = await call("foods.search", { search_expression: query, max_results: 20 }, o);
  const foods = list(d?.foods?.food).map((f) => ({ id: String(f.food_id), name: f.food_name, brand: f.brand_name || null, ...parseDescription(f.food_description) }));
  return { foods };
}

/** One food with its servings (the first serving is the default). */
export async function food(id, o) {
  if (!/^\d{1,12}$/.test(String(id ?? ""))) throw new HttpError(400, "That food id looks wrong.");
  const d = await call("food.get.v4", { food_id: id }, o);
  const f = d?.food;
  if (!f) throw new HttpError(404, "That food wasn't found.");
  const servings = list(f.servings?.serving).map((s) => ({
    id: String(s.serving_id), serving: s.serving_description, kcal: n(s.calories), protein: n(s.protein), carbs: n(s.carbohydrate), fat: n(s.fat),
    fiber: n(s.fiber), sugar: n(s.sugar), sodium: n(s.sodium), isDefault: s.is_default === "1",
  }));
  servings.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return { id: String(f.food_id), name: f.food_name, brand: f.brand_name || null, servings };
}

/** Barcode (UPC-A, EAN-13, GTIN-14 digits) → the food, or { found: false }. */
export async function barcode(code, o) {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) throw new HttpError(400, "That barcode looks wrong.");
  const d = await call("food.find_id_for_barcode", { barcode: digits.padStart(13, "0") }, o);
  const id = d?.food_id?.value ?? d?.food_id;
  if (!id || String(id) === "0") return { found: false, barcode: digits };
  return { found: true, barcode: digits, ...(await food(String(id), o)) };
}
