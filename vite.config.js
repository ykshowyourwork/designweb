import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import brand from "./brand.json" with { type: "json" };
import industries from "./content/industries.json" with { type: "json" };
import services from "./content/services.json" with { type: "json" };
import work from "./content/work.json" with { type: "json" };
import concepts from "./content/concepts.json" with { type: "json" };
import faq from "./content/faq.json" with { type: "json" };

const root = import.meta.dirname;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Lists built from the content files, dropped in wherever a page has <!-- @name -->.
const blocks = {
  industryLinks: () => industries.map((i) => `<a href="/industries/${i.slug}">${i.name}</a>`).join("\n"),
  industryTiles: () => industries.map((i) => `<a class="card" href="/industries/${i.slug}"><h3>${i.name}</h3><p class="muted">${esc(i.headline)}</p></a>`).join("\n"),
  serviceLinks: () => services.map((s) => `<a href="/services/${s.slug}">${s.name}</a>`).join("\n"),
  serviceTiles: () => services.map((s) => `<a class="card" href="/services/${s.slug}"><h3>${s.name}</h3><p class="muted">${esc(s.headline)}</p></a>`).join("\n"),
  workTiles: () =>
    work
      .map((w) => `<a class="shot-card work" href="/examples/${w.slug}"><span class="shot-img"><img src="${w.image}" alt="The ${esc(w.name)} homepage" width="1200" height="566" loading="lazy" /></span><div class="shot-text"><span class="tag">${esc(w.status ?? "Live client site")}</span><h3>${esc(w.name)}</h3><p>${esc(w.summary)}</p></div></a>`)
      .join("\n"),
  conceptTiles: () =>
    concepts
      .map((c) => `<a class="shot-card concept" href="/examples/${c.slug}" style="--accent: ${c.accent}"><span class="shot-img"><img src="/work/${c.slug}.jpg" alt="Sample ${esc(c.trade.toLowerCase())} website" width="1200" height="750" loading="lazy" /></span><div class="shot-text"><span class="tag">Sample site · ${esc(c.trade)}</span><h3>${esc(c.name)}</h3><p>${esc(c.headline)}</p></div></a>`)
      .join("\n"),
  // The examples gallery: client sites and sample sites in one grid, each with the words the search box matches.
  exampleTiles: () =>
    [
      ...work.map((w) => ({ href: `/examples/${w.slug}`, image: w.image, name: w.name, tag: w.status ?? "Live client site", text: w.summary, inds: w.industries ?? [], words: [w.industry, w.location, ...(w.services ?? [])] })),
      ...concepts.map((c) => ({ href: `/examples/${c.slug}`, image: `/work/${c.slug}.jpg`, name: c.name, tag: `Sample site · ${c.trade}`, text: c.headline, inds: [c.industry], words: [c.trade, c.city, c.intro], accent: c.accent })),
    ]
      .map((e) => {
        const names = e.inds.map((s) => industries.find((i) => i.slug === s)).filter(Boolean).flatMap((i) => [i.name, i.plural, ...(i.searches ?? [])]);
        const search = [e.name, e.tag, e.text, ...e.words, ...names].join(" ").toLowerCase();
        return `<a class="shot-card" href="${e.href}" data-ind="${e.inds.join(" ")}" data-search="${esc(search)}"${e.accent ? ` style="--accent: ${e.accent}"` : ""}><span class="shot-img"><img src="${e.image}" alt="${esc(e.name)} website" width="1200" height="750" loading="lazy" /></span><div class="shot-text"><span class="tag">${esc(e.tag)}</span><h3>${esc(e.name)}</h3><p>${esc(e.text)}</p></div></a>`;
      })
      .join("\n"),
  industryChips: () => industries.map((i) => `<button type="button" data-ind="${i.slug}">${esc(i.name)}</button>`).join("\n"),
  faq: () => faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n"),
  faqSchema: () =>
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    }).replace(/</g, "\\u003c")}</script>`,
  logo: () => fs.readFileSync(path.join(root, "brand/logo-current.svg"), "utf8"),
  contact: () => [`<a href="mailto:${brand.email}">${brand.email}</a>`, brand.phone && `<a href="tel:${brand.phone.replace(/[^\d+]/g, "")}">${brand.phone}</a>`].filter(Boolean).join("\n"),
};

// <!-- @include name --> pulls in partials/name.html, so the header, footer,
// pricing and the rest are written once and shared by every page.
const include = (html) =>
  html
    .replace(/<!-- @include (\w[\w-]*) -->/g, (m, name) => include(fs.readFileSync(path.join(root, "partials", `${name}.html`), "utf8")))
    .replace(/<!-- @(\w+) -->/g, (m, name) => (blocks[name] ? blocks[name]() : m));

// Then the business name and contact details: %name%, %email%… from brand.json.
const fill = (html) =>
  html.replace(/%(\w+)%/g, (m, key) => {
    if (key === "callHref") return brand.callUrl || "/book-a-call";
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
