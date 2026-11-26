import { test } from "node:test";
import assert from "node:assert/strict";
import { barcode, call, food, parseDescription, search } from "../api/_fatsecret.js";

const env = { FATSECRET_CONSUMER_KEY: "key123", FATSECRET_CONSUMER_SECRET: "secret456" };
const fake = (reply, seen = []) => async (url, init) => {
  const p = Object.fromEntries(new URLSearchParams(init.body));
  seen.push(p);
  return { json: async () => reply(p) };
};

test("parses a food description into macros", () => {
  assert.deepEqual(parseDescription("Per 1 cup - Calories: 130kcal | Fat: 0.00g | Carbs: 9.00g | Protein: 23.00g"),
    { serving: "1 cup", kcal: 130, fat: 0, carbs: 9, protein: 23 });
});

test("signs every request with OAuth 1.0 HMAC-SHA1 and the consumer key", async () => {
  const seen = [];
  await call("foods.search", { search_expression: "egg" }, { env, fetchImpl: fake(() => ({}), seen) });
  const p = seen[0];
  assert.equal(p.method, "foods.search");
  assert.equal(p.format, "json");
  assert.equal(p.oauth_consumer_key, "key123");
  assert.equal(p.oauth_signature_method, "HMAC-SHA1");
  assert.ok(p.oauth_signature.length > 20);
  assert.ok(!JSON.stringify(p).includes("secret456"), "the secret is never sent");
});

test("says food data isn't connected when keys are missing", async () => {
  await assert.rejects(() => call("foods.search", {}, { env: {}, fetchImpl: fake(() => ({})) }), /isn't connected/);
});

test("search returns tidy foods", async () => {
  const out = await search("chicken", { env, fetchImpl: fake(() => ({ foods: { food: { food_id: "1", food_name: "Chicken Breast", food_description: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g" } } })) });
  assert.equal(out.foods.length, 1);
  assert.equal(out.foods[0].protein, 31);
  assert.equal(out.foods[0].serving, "100g");
});

test("barcode not found comes back as found:false; found returns the default serving first", async () => {
  const none = await barcode("012345678905", { env, fetchImpl: fake(() => ({ food_id: { value: "0" } })) });
  assert.equal(none.found, false);
  const hit = await barcode("12345678905", { env, fetchImpl: fake((p) => p.method === "food.find_id_for_barcode"
    ? (assert.equal(p.barcode, "0012345678905"), { food_id: { value: "77" } })
    : { food: { food_id: "77", food_name: "Greek Yogurt", brand_name: "Brand", servings: { serving: [
      { serving_id: "1", serving_description: "100 g", calories: "59", protein: "10", carbohydrate: "3.6", fat: "0.4", is_default: "0" },
      { serving_id: "2", serving_description: "1 container", calories: "90", protein: "15", carbohydrate: "6", fat: "0", is_default: "1" }] } } }) });
  assert.equal(hit.found, true);
  assert.equal(hit.servings[0].serving, "1 container");
});

test("bad ids and barcodes are refused", async () => {
  await assert.rejects(() => food("abc", { env, fetchImpl: fake(() => ({})) }), /looks wrong/);
  await assert.rejects(() => barcode("12", { env, fetchImpl: fake(() => ({})) }), /looks wrong/);
});
