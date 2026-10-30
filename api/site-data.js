// Public, read-only: the facts a demo site or proposal deck is built from.
//   GET ?slug=qq-nails → { slug, business, phone, rating, reviews, site, ... }
import { handler } from "./_core.js";
import { getSite } from "./_network.js";

export default handler(async (req, res) => {
  res?.setHeader?.("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  res?.setHeader?.("X-Robots-Tag", "noindex");
  return getSite(req.query.slug);
});
