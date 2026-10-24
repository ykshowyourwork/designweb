// Owner sign-in.
//   POST { email, password }   → { token, refresh, expiresAt, email }
//   POST { refresh }           → a fresh session
import { HttpError, handler } from "./_core.js";
import { refresh, signIn } from "./_auth.js";

export default handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  return b.refresh ? refresh(b.refresh) : signIn(b.email, b.password);
});
