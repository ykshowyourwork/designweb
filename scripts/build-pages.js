// Writes the pages that come from content files, before every dev or build run:
//   content/industries.json → industries/<slug>/index.html (templates/industry.html)
//   content/services.json   → services/<slug>/index.html   (templates/service.html)
//   content/work.json       → examples/<slug>/index.html   (templates/work.html, real client sites)
//   content/concepts.json   → examples/<slug>/index.html   (templates/concept.html, sample sites)
//   every page              → public/sitemap.xml and public/llms.txt
// To add a page of one of these kinds, add it to its content file. Nothing else changes.
import fs from "node:fs";
import path from "node:path";
import brand from "../brand.json" with { type: "json" };
import industries from "../content/industries.json" with { type: "json" };
import services from "../content/services.json" with { type: "json" };
import work from "../content/work.json" with { type: "json" };
import concepts from "../content/concepts.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const site = `https://${brand.domain}`;
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const list = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");
const provider = { "@type": "ProfessionalService", name: brand.name, url: `${site}/` };

// Fills {{key}} from `values`; keys in `raw` are already HTML, everything else is escaped.
function write(templateName, dir, values, raw = {}) {
  const template = fs.readFileSync(path.join(root, "templates", templateName), "utf8");
  const html = template.replace(/{{(\w+)}}/g, (m, k) => (k in raw ? raw[k] : k in values ? esc(values[k]) : m));
  fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, dir, "index.html"), html);
}

for (const ind of industries) {
  write("industry.html", `industries/${ind.slug}`, ind, {
    schema: json({
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Websites for ${ind.plural}`,
      serviceType: "Website design",
      provider,
      areaServed: "US",
      offers: { "@type": "Offer", price: "1750", priceCurrency: "USD" },
    }),
    searches: ind.searches.map((q) => `<div class="card"><strong>"${esc(q)}"</strong></div>`).join(""),
    build: list(ind.build),
  });
}

for (const s of services) {
  write("service.html", `services/${s.slug}`, s, {
    schema: json({ "@context": "https://schema.org", "@type": "Service", name: s.title, serviceType: s.name, description: s.intro, provider, areaServed: "US" }),
    includes: list(s.includes),
  });
}

for (const w of work) {
  write("work.html", `examples/${w.slug}`, { ...w, services: w.services.join(", ") }, { built: list(w.built) });
}

for (const c of concepts) {
  const pages = [...c.services.map(([name]) => name), ...c.towns.map((t) => `${c.trade} in ${t}`)];
  write("concept.html", `examples/${c.slug}`, c, {
    theme: c.dark ? "dark" : "",
    emergencyBar: c.emergency ? `<a class="c-emergency" href="#" data-demo>${esc(c.emergency)}</a>` : "",
    emergencyNote: c.emergency
      ? `<li><strong>Emergency first.</strong> Someone searching "emergency ${esc(c.trade.toLowerCase())}" wants to call now, so a 24/7 call bar sits above everything else.</li>`
      : "",
    trust: list(c.trust),
    services: c.services.map(([h, p]) => `<div class="c-card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join(""),
    towns: list(c.towns),
    reviews: c.reviews.map(([q, who]) => `<div class="c-card"><p>"${esc(q)}"</p><cite>${esc(who)}</cite></div>`).join(""),
    pageList: esc(pages.join(", ")),
  });
}

const pages = [
  "/",
  "/how-it-works",
  "/what-you-get",
  "/services",
  ...services.map((s) => `/services/${s.slug}`),
  "/pricing",
  "/industries",
  ...industries.map((i) => `/industries/${i.slug}`),
  "/examples",
  ...work.map((w) => `/examples/${w.slug}`),
  "/faq",
  "/about",
  "/book-a-call",
  "/free-mockup",
  "/terms",
  "/privacy",
];
fs.writeFileSync(
  path.join(root, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${site}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(root, "public/llms.txt"),
  `# ${brand.name}

> ${brand.name} builds websites for local service businesses in the US that rank on Google, get named by AI assistants, and turn visitors into quote requests, bookings and paid invoices. From $1,750, live in about two weeks.

## Pricing
- Starter: $1,750
- Growth: $3,500 + $300/mo (month to month)
- Full Stack: from $7,500
- App Store add-on: $1,000
- Payment: 50% deposit, 50% on launch day, by card through Stripe

## Services
${services.map((s) => `- [${s.name}](${site}/services/${s.slug}): ${s.intro}`).join("\n")}

## Industries
${industries.map((i) => `- [Websites for ${i.plural}](${site}/industries/${i.slug})`).join("\n")}

## Work
${work.map((w) => `- [${w.name}](${site}/examples/${w.slug}): ${w.summary}`).join("\n")}

## Pages
- [How it works](${site}/how-it-works)
- [Pricing](${site}/pricing)
- [FAQ](${site}/faq)
- [Book a call](${site}/book-a-call)
- [Free mockup](${site}/free-mockup)
- [Terms](${site}/terms)

Contact: ${brand.email}${brand.phone ? ` · ${brand.phone}` : ""}
`,
);
console.log(`pages: ${industries.length} industries, ${services.length} services, ${work.length} case studies, ${concepts.length} samples, ${pages.length} in the sitemap`);
