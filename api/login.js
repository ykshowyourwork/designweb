// Owner sign-in.
//   POST { email, password }   → { token, refresh, expiresAt, email }
//   POST { refresh }           → a fresh session
//   POST { reset: email }      → emails a "set your password" link
//   POST { code, password }    → saves the new password from that link and signs in
import { HttpError, handler } from "./_core.js";
import { refresh, sendReset, setPassword, signIn } from "./_auth.js";

export default handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.reset) return sendReset(b.reset);
  if (b.code) return setPassword(b.code, b.password);
  return b.refresh ? refresh(b.refresh) : signIn(b.email, b.password);
});
