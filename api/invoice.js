// GET /api/invoice?token=…  → the client's invoice page data. No login: the token is the key.
import { getProject, handler } from "./_core.js";
import { stripe } from "./_stripe.js";

export default handler((req) => getProject(stripe(), req.query.token));
