// Public, read-only food lookups for the fitness app (desiweb.org/lab/fitness), from FatSecret.
//   GET ?q=chicken breast     → { foods: [{ id, name, brand, serving, kcal, protein, carbs, fat }] }
//   GET ?id=33691             → { id, name, brand, servings: [...] }
//   GET ?barcode=012345678905 → { found, barcode, id, name, brand, servings }
import { HttpError, handler } from "./_core.js";
import { barcode, food, search } from "./_fatsecret.js";

export default handler(async (req, res) => {
  res?.setHeader?.("X-Robots-Tag", "noindex");
  const q = req.query ?? {};
  let out;
  if (q.barcode) out = await barcode(q.barcode);
  else if (q.id) out = await food(q.id);
  else if (q.q) out = await search(q.q);
  else throw new HttpError(400, "Ask with ?q=, ?id= or ?barcode=.");
  // Foods don't change often: the edge keeps good answers for a day (errors are never cached).
  res?.setHeader?.("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return out;
});
