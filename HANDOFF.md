# Handoff: where things stand (2026-10-21)

Read this first. It covers the business, what's built, where everything lives, and what's next.

## The business

Selling websites to local service businesses by cold calling. Working name **DesignWeb** (final name not picked; "DigBiz Digital" was floated). Goal: book 10 clients, then turn every step into a Notion guide an AI agent can follow.

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
| Cold call list: 926 businesses, 434 with no website | Notion database "Website Cold Call List" (inside the YK ENTERTAINMENT page), id `67184cda17ee4835b65d157259e2a353` |
| Website leads inbox (the /free-mockup form writes here) | Notion database "DesignWeb Inbound Leads" (private), id `9333b0479f054dbcb1f79abf3177d868` |
| Relume plan for this site | https://www.relume.ai/app/site/01a15e8c-35db-7504-bd4a-eabf65e4fbdd |
| Lead research credits | OpenSEO, about 7,900 credits left (each business search ≈ 35 credits for up to 50 businesses) |

### Cold call list notes
- Columns: Status, Phone, Category, Website, No website, Unclaimed Google, Rating, Reviews, Area, Opener (a first line for each call), Package, Follow up, Notes, Google Maps.
- Call "No website" rows first, sorted by Reviews, highest first.
- Top leads so far: JL Absolute Tree Service, Independence MO (816) 499-9893, 411 reviews · Pines Tree Service, Spring TX (346) 668-4946, 216 · Friendswood Tree & Fence, TX (281) 282-7924, 141.
- Tree services have the most reviews with no website in every city searched. It's the strongest niche so far.

## What's built (this repo)

- 11 public pages: home, how it works, what you get, pricing, industries + 6 trade pages, examples, FAQ, about, free mockup. Google and AI ready (Schema, sitemap, llms.txt).
- `/free-mockup` form → a new row in Notion "DesignWeb Inbound Leads" (needs `NOTION_TOKEN`).
- `/invoice/<token>` and `/admin`: invoices in Stripe, 50% deposit emailed right away, balance sent on launch day with one button. No database.
- Tests: `npm test` (7 passing). Checked on a phone-sized screen: all pages fit and all links work.

## Not done yet

1. **Go live:** import this repo into Vercel and set `STRIPE_SECRET_KEY`, `ADMIN_PASSWORD`, `NOTION_TOKEN`, `NOTION_LEADS_DB`. Share the Notion leads database with the Notion integration.
2. **Pick the name and domain**, then update `brand.json` (name, domain, email, `callUrl` booking link). The contact email is currently yardyknowent@gmail.com.
3. **Stripe:** use a separate Stripe account for this business (recommended) and set its name and logo under Settings → Branding.
4. **Relume:** review the Relume project in Chrome and compare it to this site. Also run the JL Absolute Tree Service Relume prompt to make the first example/mockup.
5. **Decide:** whether Full Stack has a monthly fee ($750–1,500/mo was discussed; the site shows none).
6. **Call script open questions:** what company name callers give; whether "YK Entertainment brought in $2,500" means money earned through the site or paid for the build; add a real result for the proof line.
7. **Notion step-by-step guide for AI agents:** write it after the first client goes through the full process (find lead → call → mockup → deposit → build → launch → balance).
8. **Cleanup:** delete the unused `yk-invoice-site` branch in the-set repo on GitHub (Branches page). It never touched the live site.
