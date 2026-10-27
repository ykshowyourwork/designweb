import { test } from "node:test";
import assert from "node:assert/strict";
import { coldCallRow, inboundRow } from "../scripts/import-notion.js";

const t = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const sel = (n) => ({ type: "select", select: n ? { name: n } : null });
const st = (n) => ({ type: "status", status: { name: n } });

test("a cold-call row keeps its Google id, call status and details", () => {
  const r = coldCallRow({
    id: "p1",
    properties: {
      Business: { type: "title", title: [{ plain_text: "JL Absolute Tree Service" }] },
      Status: st("Voicemail"),
      Category: sel("Home services"),
      Phone: { type: "phone_number", phone_number: "(816) 499-9893" },
      "Google Maps": { type: "url", url: "https://www.google.com/maps?cid=10843971670360074619&hl=en&gl=US" },
      Rating: { type: "number", number: 5 },
      Reviews: { type: "number", number: 416 },
      "No website": { type: "checkbox", checkbox: true },
      Notes: t("Audit deck sent"),
    },
  });
  assert.equal(r.stage, "call");
  assert.equal(r.google_cid, "10843971670360074619");
  assert.equal(r.reviews, 416);
  assert.equal(r.no_website, true);
  assert.equal(r.notes, "Audit deck sent Last call: Voicemail.");
  assert.equal(r.notion_page_id, "p1");
});

test("cold-call outcomes map to Network stages", () => {
  const stage = (s) => coldCallRow({ id: "x", properties: { Business: { type: "title", title: [{ plain_text: "B" }] }, Status: st(s) } }).stage;
  assert.equal(stage("Won"), "yes");
  assert.equal(stage("Not interested"), "pass");
  assert.equal(stage("Demo booked"), "replied");
  assert.equal(stage("Not called"), "call");
});

test("a website form request comes in warm with its budget", () => {
  const r = inboundRow({
    id: "p2",
    properties: {
      Business: { type: "title", title: [{ plain_text: "Pines Tree Service" }] },
      Status: st("New"),
      Email: { type: "email", email: "Sam@Pines.com" },
      Budget: sel("$5k – $15k"),
      Page: t("/book-a-call"),
    },
  });
  assert.equal(r.stage, "warm");
  assert.equal(r.email, "sam@pines.com");
  assert.equal(r.budget, "$5k – $15k");
  assert.equal(r.source, "Website form (/book-a-call)");
});
