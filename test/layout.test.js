import { test } from "node:test";
import assert from "node:assert/strict";
import { getLayout, queueExample, saveLayout } from "../api/_network.js";

const env = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc" };

// A tiny fake of the site_layout table.
function fakeTable() {
  const store = { examples: [], industries: [], queue: [] };
  const fetchImpl = async (url, init = {}) => {
    const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data ?? ""), json: async () => data });
    if (init.method === "POST") {
      const b = JSON.parse(init.body);
      store[b.key] = b.items;
      return ok(null);
    }
    return ok(Object.entries(store).map(([key, items]) => ({ key, items })));
  };
  return { store, o: { env, fetchImpl } };
}

test("saveLayout keeps the order, drops bad and repeated slugs, and only saves the lists sent", async () => {
  const { store, o } = fakeTable();
  store.industries = [{ slug: "roofing", hidden: false }];
  await saveLayout({ examples: [{ slug: "mole-del-rey" }, { slug: "las-chinampas", hidden: true }, { slug: "mole-del-rey" }, { slug: "Bad Slug!" }] }, o);
  assert.deepEqual(store.examples, [{ slug: "mole-del-rey", hidden: false }, { slug: "las-chinampas", hidden: true }]);
  assert.deepEqual(store.industries, [{ slug: "roofing", hidden: false }]);
});

test("queueExample adds a demo once and can take it back off", async () => {
  const { store, o } = fakeTable();
  await queueExample("don-zarape-restaurant-2", true, o);
  await queueExample("don-zarape-restaurant-2", true, o);
  assert.deepEqual(store.queue, ["don-zarape-restaurant-2"]);
  await queueExample("don-zarape-restaurant-2", false, o);
  assert.deepEqual((await getLayout(o)).queue, []);
  await assert.rejects(queueExample("../etc", true, o), /Pick a demo/);
});
