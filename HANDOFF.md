# Handoff: where things stand (2026-10-21)

Read this first. It covers the business, what's built, where everything lives, and what's next.

## The business

Selling websites to local service businesses by cold calling. Name: **DesiWeb**, domain **desiweb.org** (bought 2026-10-21). Goal: book 10 clients, then turn every step into a Notion guide an AI agent can follow.

Pricing: Starter $1,500 · Growth $3,500 + $300/mo (month to month) · Full Stack from $7,500 · App Store add-on $1,000 ($500 intro for the first 3 clients) · 50% deposit, 50% at launch.

## How to talk to the owner

- Plain English, 5th grade reading level. Simple words, short sentences. **No analogies.**
- When explaining something technical, give the technical version, then the plain-English version.
- Their sales voice: "Anybody can build a website. That part is elementary. Having a website is like having money in the bank: what is your money doing for you?" and "The game is who does it first."
- Keep this project separate from The Set and YK Entertainment. Don't build on those repos.

## Where everything is

| What | Where |
| --- | --- |
| This site (sales site + invoices + lead form) | github.com/ykshowyourwork/designweb. Start with `README.md` |
| Sales cheat sheet (terms, pricing, add-ons) | Claude Doc: https://claude.ai/artifact/FjYKGLsRazAapaCQtTwqmY |
| Full call script + rebuttals + voicemail + follow-up | Claude Doc: https://claude.ai/artifact/8NCSufdp8AmfBLEg1iYAZh |
| Cold call list: 926 businesses, 434 with no website | Notion database "Website Cold Call List" (moved 2026-10-21 into the Notion page "designweb.org" with the call script and Relume sitemap), id `67184cda17ee4835b65d157259e2a353` |
| Website leads inbox (the /free-mockup form writes here) | Notion database "DesignWeb Inbound Leads" (private), id `9333b0479f054dbcb1f79abf3177d868` |
| Relume plan for this site | https://www.relume.ai/app/site/01a15e8c-35db-7504-bd4a-eabf65e4fbdd |
| Lead audit decks (the "show them the money" pitch) | JL Absolute: https://claude.ai/artifact/2AkV8YnTB3vwSvThs2HX5n · Pines Tree Service: https://claude.ai/artifact/U7dBb35KRvqjQL9q5rHPoL · Friendswood Tree & Fence: https://claude.ai/artifact/1NTaP1zmPWz8eMCns6BZ3u (links also in each Notion row). Format: Maps ranking first, plain "what these searches are worth" money slide, Starter $1,750 |
| Lead research credits | OpenSEO, about 7,900 credits left (each business search ≈ 35 credits for up to 50 businesses) |

### Cold call list notes
- Columns: Status, Phone, Category, Website, No website, Unclaimed Google, Rating, Reviews, Area, Opener (a first line for each call), Package, Follow up, Notes, Google Maps.
- Call "No website" rows first, sorted by Reviews, highest first.
- Top leads so far: JL Absolute Tree Service, Independence MO (816) 499-9893, 411 reviews · Pines Tree Service, Spring TX (346) 668-4946, 216 · Friendswood Tree & Fence, TX (281) 282-7924, 141.
- Tree services have the most reviews with no website in every city searched. It's the strongest niche so far.

## Logo (2026-10-21)

Option B: the blue "d." tile + "DesiWeb." wordmark, made from Inter 800 (free commercial license, SIL OFL). Files in `brand/`: `logo.svg` (dark text), `logo-white.svg` (for dark backgrounds), `icon.svg`, `icon-512.png`, `logo-on-white.png`, `stripe-icon.png` (square, for Stripe → Settings → Branding → Icon). The site header, footer, invoice and admin pages use `brand/logo-current.svg`; the browser-tab icon is `public/favicon.svg`. Other options are in `brand/logo-options/`. Don't use the Druk or "Demo" fonts on this Mac for anything commercial: they're trial licenses.

## What's built (this repo)

- Public pages: home, how it works, what you get, services + 6 service pages, pricing, industries + 6 trade pages, examples (The Set and YK case studies + 5 sample sites), FAQ, about, book a call, free mockup, terms, privacy. Google and AI ready (Schema, sitemap, llms.txt, link preview image).
- Everything Relume's plan had is in the site (2026-10-21). Relume only ever had the Home page laid out; the site is now the source of truth. Next phase: the look and feel, based on https://fluid22.com/.
- Sample sites (`/examples/<slug>`) are made-up businesses, clearly labeled, set to noindex, with 555 phone numbers. The tree service one leads with a 24/7 emergency call bar.
- `/free-mockup` form → a new row in Notion "DesignWeb Inbound Leads" (needs `NOTION_TOKEN`).
- `/invoice/<token>` and `/admin`: invoices in Stripe, 50% deposit emailed right away, balance sent on launch day with one button. No database.
- Tests: `npm test` (7 passing). Checked on a phone-sized screen: all pages fit and all links work.

## Not done yet

1. **Live at https://desiweb.org (2026-10-21).** Vercel project `desiweb` in the yardy-know team, its own project and keys. Pushing to GitHub `main` deploys on its own. DNS at Porkbun: A @ 216.198.79.1 and 64.29.17.1, CNAME www → 75a461a63d316baa.vercel-dns-017.com (www redirects to desiweb.org). Already set in Vercel: `NOTION_LEADS_DB`, `SITE_URL`. **Still needed:** `STRIPE_SECRET_KEY`, `ADMIN_PASSWORD`, `NOTION_TOKEN`. The owner runs `bash scripts/set-secrets.sh` (hidden typing, redeploys). Until then the forms and invoices show an error. Share the Notion leads database with the DesiWeb integration (••• → Connections).
2. **Domain email and phone:** set up an @desiweb.org email (for example hello@desiweb.org) and a business phone, then put them in `brand.json` (`email`, `phone`). The contact email is still yardyknowent@gmail.com, which is shown on invoices. Optional: a Calendly link in `callUrl` (empty = the /book-a-call form).
2b. **Review the Terms page** (`terms/index.html`), mainly the refund policy: full deposit refund before the build starts, none after. It's a plain-English draft, not legal advice.
3. **Stripe:** use a separate Stripe account for this business (recommended) and set its name and logo under Settings → Branding.
4. **Relume:** review the Relume project in Chrome and compare it to this site. Also run the JL Absolute Tree Service Relume prompt to make the first example/mockup.
5. **Decide:** whether Full Stack has a monthly fee ($750–1,500/mo was discussed; the site shows none).
6. **Call script open questions:** what company name callers give; whether "YK Entertainment brought in $2,500" means money earned through the site or paid for the build; add a real result for the proof line.
7. **Notion step-by-step guide for AI agents:** write it after the first client goes through the full process (find lead → call → mockup → deposit → build → launch → balance).
8. **Cleanup:** done 2026-10-21: the unused `yk-invoice-site` branch (pay.yardyknowent.com) was deleted from the-set repo. It never touched the live site. No YK invoice work belongs in DesiWeb.
