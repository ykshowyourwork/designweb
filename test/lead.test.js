import { test } from "node:test";
import assert from "node:assert/strict";
import { notionPage, parseLead, saveLead } from "../api/_lead.js";

const good = { business: "Pines Tree Service", name: "Sam", phone: "(346) 668-4946", email: "Sam@Pines.com", industry: "Tree service", google: "maps.google.com/?cid=1", page: "/industries/tree-service" };

test("a good request becomes a Notion row marked New", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return { ok: true, text: async () => "" };
  };
  assert.deepEqual(await saveLead(good, { fetchImpl, env: { NOTION_TOKEN: "t", NOTION_LEADS_DB: "db1" } }), { ok: true });
  const body = JSON.parse(sent.init.body);
  assert.equal(body.parent.database_id, "db1");
  assert.equal(body.properties.Business.title[0].text.content, "Pines Tree Service");
  assert.equal(body.properties.Status.status.name, "New");
  assert.equal(body.properties.Email.email, "sam@pines.com");
  assert.equal(body.properties["Google listing"].url, "https://maps.google.com/?cid=1");
  assert.equal(body.properties["Current website"].url, null);
});

test("bots are dropped quietly and bad forms are refused", async () => {
  const fetchImpl = async () => assert.fail("should not call Notion");
  assert.deepEqual(await saveLead({ ...good, company: "spam" }, { fetchImpl, env: {} }), { ok: true });
  assert.throws(() => parseLead({ ...good, phone: "123" }), /phone/);
  assert.throws(() => parseLead({ ...good, email: "x" }), /email/);
  assert.equal(parseLead({ ...good, industry: "Nope" }).industry, "Other");
  assert.equal(notionPage(parseLead({ ...good, message: "" }), "d").properties.Message.rich_text.length, 0);
});

test("a call request says so in the Message, with the best time", () => {
  const msg = (body) => notionPage(parseLead(body), "d").properties.Message.rich_text[0].text.content;
  assert.equal(msg({ ...good, kind: "call", when: "Evening", message: "Need a new site" }), "Call request. Best time: Evening. Need a new site");
  assert.equal(msg({ ...good, kind: "call", when: "3am" }), "Call request. Best time: Any time.");
  assert.equal(msg({ ...good, message: "Hi" }), "Hi");
});

test("a Notion error is not reported as success", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => "unauthorized" });
  await assert.rejects(saveLead(good, { fetchImpl, env: { NOTION_TOKEN: "t", NOTION_LEADS_DB: "d" } }), /401/);
});
