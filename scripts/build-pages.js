// Writes the pages that come from content files, before every dev or build run:
//   content/industries.json → industries/<slug>/index.html (from templates/industry.html)
//   every page              → public/sitemap.xml and public/llms.txt
// To add an industry, add it to content/industries.json. Nothing else changes.
import fs from "node:fs";
import path from "node:path";
import brand from "../brand.json" with { type: "json" };
import industries from "../content/industries.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const site = `https://${brand.domain}`;

const template = fs.readFileSync(path.join(root, "templates/industry.html"), "utf8");
for (const ind of industries) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Websites for ${ind.plural}`,
    serviceType: "Website design",
    provider: { "@type": "ProfessionalService", name: brand.name, url: `${site}/` },
    areaServed: "US",
    offers: { "@type": "Offer", price: "1500", priceCurrency: "USD" },
  };
  const html = template
    .replace(/{{schema}}/g, JSON.stringify(schema).replace(/</g, "\\u003c"))
    .replace(/{{searches}}/g, ind.searches.map((q) => `<div class="card"><strong>"${esc(q)}"</strong></div>`).join(""))
    .replace(/{{build}}/g, ind.build.map((b) => `<li>${esc(b)}</li>`).join(""))
    .replace(/{{(\w+)}}/g, (m, k) => (k in ind ? esc(ind[k]) : m));
  const dir = path.join(root, "industries", ind.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

const pages = ["/", "/how-it-works", "/what-you-get", "/pricing", "/industries", ...industries.map((i) => `/industries/${i.slug}`), "/examples", "/faq", "/about", "/free-mockup"];
fs.writeFileSync(
  path.join(root, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${site}${p === "/" ? "/" : p}</loc></url>`).join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(root, "public/llms.txt"),
  `# ${brand.name}\n\n> ${brand.name} builds websites for local service businesses in the US that rank on Google, get named by AI assistants, and turn visitors into quote requests, bookings and paid invoices. From $1,500, live in about two weeks.\n\n## Pricing\n- Starter: $1,500\n- Growth: $3,500 + $300/mo (month to month)\n- Full Stack: from $7,500\n- App Store add-on: $1,000\n\n## Industries\n${industries.map((i) => `- [Websites for ${i.plural}](${site}/industries/${i.slug})`).join("\n")}\n\n## Pages\n- [How it works](${site}/how-it-works)\n- [Pricing](${site}/pricing)\n- [FAQ](${site}/faq)\n- [Free mockup](${site}/free-mockup)\n\nContact: ${brand.email}\n`,
);
console.log(`pages: ${industries.length} industries, ${pages.length} in the sitemap`);
