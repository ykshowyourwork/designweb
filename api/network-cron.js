// The daily email send, run by Vercel's timer (vercel.json "crons") at 9am Los Angeles time,
// after the 7am routine has written the drafts. The routine itself isn't allowed to send email,
// so the site does it. Sends only when automatic sending is on, and never more than the day's
// batch (see sendBatch's daily cap), so an extra call can't email anyone twice or early.
// If CRON_SECRET is set, Vercel sends it and anything without it is turned away.
import { HttpError, handler } from "./_core.js";
import { autoSendOn, getSettings, networkReady, sendBatch } from "./_network.js";

const today = () => new Date().toISOString().slice(0, 10);

export default handler(async (req) => {
  if (req.method !== "GET") throw new HttpError(405, "Not allowed.");
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, "Wrong key.");
  if (!networkReady()) throw new HttpError(503, "The Network database isn't connected yet.");
  if (!autoSendOn(await getSettings(), today())) return { skipped: "Automatic sending is off." };
  const r = await sendBatch({ daily: true });
  console.log(`network-cron: sent ${r.sent}, failed ${r.failed}`);
  return r;
});
