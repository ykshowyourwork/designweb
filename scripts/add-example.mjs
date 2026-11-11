// Puts a custom demo site Jordan likes onto desiweb.org:
//   node scripts/add-example.mjs <slug> [--industry <industry-slug>]
// 1. Screenshots the live demo (https://desiweb.org/demo/<slug>/) for its tile → public/work/<slug>.jpg
// 2. Adds or refreshes its entry at the top of content/work.json from the saved research (real facts only),
//    with today's date, so it shows first on /examples, on the homepage and on its industry page.
// The next build makes its /examples/<slug> page. Read the new entry's words before pushing.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const slug = args[0];
const forced = args.includes("--industry") ? args[args.indexOf("--industry") + 1] : null;
if (!/^[a-z0-9-]{3,60}$/.test(slug || "")) throw new Error("Usage: node scripts/add-example.mjs <slug> [--industry <industry-slug>]");
if (!fs.existsSync(path.join(root, "demo", slug, "index.html"))) throw new Error(`No custom demo at demo/${slug}/index.html`);

// Which industry page it belongs on, from its trade.
const TRADES = [
  [/restaurant|taco|taquer|bakery|cafe|mariscos|food|grill|pizza|bbq|diner|kitchen|mole/i, "restaurants"],
  [/tree/i, "tree-service"],
  [/roof/i, "roofing"],
  [/hvac|heating|air cond|\bac\b/i, "hvac"],
  [/plumb|rooter|drain/i, "plumbing"],
  [/nail|salon|barber|spa|lash|brow|hair|beauty|wax/i, "salons-and-barbers"],
  [/wedding|photograph|video|dj|venue|florist|event/i, "wedding-vendors"],
  [/auto|smog|mechanic|tire|brake|car|truck/i, "auto-repair-and-performance"],
];

const res = await fetch(`https://desiweb.org/api/site-data?slug=${slug}`);
if (!res.ok) throw new Error(`No saved research for ${slug} (${res.status})`);
const d = await res.json();
const s = d.site || {};
const trade = s.trade || d.category || "local business";
const town = s.town || d.area || "";
const industry = forced || TRADES.find(([re]) => re.test(`${trade} ${d.category} ${d.business}`))?.[1];
const industries = JSON.parse(fs.readFileSync(path.join(root, "content/industries.json"), "utf8"));
const ind = industries.find((i) => i.slug === industry);
if (!ind) throw new Error(`No industry page for "${trade}". Add one to content/industries.json, then rerun with --industry <slug>.`);

// The tile picture: the demo's first screen on a computer.
const shot = path.join(root, "public/work", `${slug}.png`);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
execFileSync(chrome, ["--headless=new", "--hide-scrollbars", "--window-size=1200,750", "--virtual-time-budget=6000", `--screenshot=${shot}`, `https://desiweb.org/demo/${slug}/?shot=1`], { stdio: "ignore" });
execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", shot, "--out", path.join(root, "public/work", `${slug}.jpg`)], { stdio: "ignore" });
fs.unlinkSync(shot);

// Public words, about the business (the saved research talks to the owner, so it isn't reused here).
const tradeName = trade.replace(/\b(mexican|american|italian|chinese|thai|korean|japanese|vietnamese|salvadoran|armenian)\b/gi, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
const state = (s.address || "").match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1];
const place = state && !town.includes(",") ? `${town}, ${state}` : town;
const rank = s.maps?.rank && s.maps?.keyword ? ` It already showed up #${s.maps.rank} for "${s.maps.keyword}" on Google Maps, with nowhere to send those people.` : "";
const stars = d.rating ? ` at ${Number(d.rating).toFixed(1)} stars` : "";
const entry = {
  slug,
  name: d.business,
  status: "Free mockup",
  url: `/demo/${slug}`,
  image: `/work/${slug}.jpg`,
  summary: `A free homepage we built for ${d.business}, a ${tradeName} in ${place}, from its real photos and reviews.`,
  industry: ind.name,
  location: place,
  launched: "Free mockup",
  services: ["Website design", "Story mode on phones", "Google Maps setup"],
  client: `${d.business} is a ${tradeName} in ${place}${d.reviews ? ` with ${Number(d.reviews).toLocaleString()} Google reviews${stars}` : ""}.`,
  challenge: `Customers love it on Google, but it had no website of its own.${rank}`,
  built: [
    "Its real photos in a full-screen gallery that slides on its own",
    "Story mode on phones: full-screen screens you swipe through",
    "Call, directions and the main action on every screen",
    s.theme?.tagline ? `A look built from its own sign and colors, with "${s.theme.tagline}" up front` : "A look built from its own sign and colors",
  ],
  result: "A free mockup we built to show the owner what's possible. Tap the preview to see it.",
  industries: [industry],
  added: new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }),
};

const file = path.join(root, "content/work.json");
const work = JSON.parse(fs.readFileSync(file, "utf8")).filter((w) => w.slug !== slug);
fs.writeFileSync(file, JSON.stringify([entry, ...work], null, 2) + "\n");
console.log(`Added ${d.business} → /examples/${slug} (industry: ${ind.name}). Check its words in content/work.json, then build and push.`);
