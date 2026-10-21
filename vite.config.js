import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import brand from "./brand.json" with { type: "json" };
import industries from "./content/industries.json" with { type: "json" };

const root = import.meta.dirname;

// <!-- @include name --> pulls in partials/name.html, so the header, footer,
// pricing and the rest are written once and shared by every page.
const include = (html) =>
  html
    .replace(/<!-- @include (\w[\w-]*) -->/g, (m, name) => include(fs.readFileSync(path.join(root, "partials", `${name}.html`), "utf8")))
    .replace(/<!-- @industryLinks -->/g, industries.map((i) => `<a href="/industries/${i.slug}">${i.name}</a>`).join("\n      "))
    .replace(/<!-- @industryTiles -->/g, industries.map((i) => `<a class="card" href="/industries/${i.slug}"><h3>${i.name}</h3><p class="muted">${i.headline}</p></a>`).join("\n"));

// Then the business name and contact details: %name%, %email%… from brand.json.
const fill = (html) =>
  html.replace(/%(\w+)%/g, (m, key) => {
    if (key === "callHref") return brand.callUrl || `mailto:${brand.email}?subject=${encodeURIComponent("Book a call")}`;
    if (key === "year") return String(new Date().getFullYear());
    return key in brand ? String(brand[key]) : m;
  });

// Every index.html in the project is a page, plus the invoice and admin pages.
function pages(dir = root, found = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "partials", "templates", "public", ".git", ".vercel"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, found);
    else if (e.name.endsWith(".html")) found[path.relative(root, p).replace(/\.html$/, "").replace(/[\\/]/g, "_")] = p;
  }
  return found;
}

export default defineConfig({
  plugins: [{ name: "pages", transformIndexHtml: { order: "pre", handler: (html) => fill(include(html)) } }],
  build: { rollupOptions: { input: pages() } },
});
