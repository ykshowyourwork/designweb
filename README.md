# DesiWeb

Sales site and invoice payments for DesiWeb (desiweb.org). The name, domain and contact details live in `brand.json`; every page follows.

- `/` the sales site, plus How it works, What you get, Services (one page per service), Pricing, Industries (one page per trade), Examples, FAQ, About, Book a call, Free mockup, Terms and Privacy. Static HTML, Google and AI ready: meta tags, Schema, sitemap, llms.txt, link preview image (`public/og.png`)
- `/examples` real client sites (case studies) and sample sites for made-up businesses, one per trade
- `/free-mockup` and `/book-a-call` the lead forms: every request becomes a row in the Notion database "DesignWeb Inbound Leads" (call requests start with "Call request. Best time: …")
- `/invoice/<token>` a client's invoice: deposit and balance, paid by card through Stripe
- `/admin` make invoices, see who paid, send the balance on launch day

No database. Each project is a Stripe customer with two invoices: the deposit is emailed right away, the balance is held as a draft until you press **Send balance**. Stripe sends the emails, takes the card, sends receipts and reminders.

## Changing the site

| To change | Edit |
| --- | --- |
| Business name, domain, email, phone, booking link | `brand.json` |
| Add or edit a trade page | `content/industries.json` (pages, links, sitemap all follow) |
| Add or edit a service page | `content/services.json` |
| Add a client case study | `content/work.json` + a screenshot in `public/work/` |
| Add or edit a sample site | `content/concepts.json` |
| FAQ (page, home and Google's FAQ code) | `content/faq.json` |
| Terms and refund policy, privacy | `terms/index.html`, `privacy/index.html` |
| Header, footer, pricing, FAQ, steps | the matching file in `partials/` (shared by every page) |
| One page's own text | that page's `index.html` (e.g. `pricing/index.html`) |

`scripts/build-pages.js` writes the industry, service, case study and sample pages, `sitemap.xml` and `llms.txt` before every `dev` and `build`; don't edit those outputs.

## Settings

`brand.json`: name, tagline, domain, contact email, `phone` (shown in the footer when set), `callUrl` (a Calendly or booking link; empty = the /book-a-call form).

Vercel environment variables:

| Name | What |
| --- | --- |
| `STRIPE_SECRET_KEY` | The business's Stripe secret key (`sk_live_…`, or `sk_test_…` to try it) |
| `ADMIN_PASSWORD` | Password for `/admin`, 8+ characters |
| `NOTION_TOKEN` | A Notion internal integration token. Share the "DesignWeb Inbound Leads" database with that integration |
| `NOTION_LEADS_DB` | That database's id: `9333b0479f054dbcb1f79abf3177d868` |
| `SITE_URL` | Optional. Defaults to `https://<domain from brand.json>` |

In Stripe → Settings → Branding, set the business name, logo and color: that's what clients see on the invoice emails and the pay page. Stripe only emails invoices in live mode.

## Run it

```
npm install
npm test        # invoices against a fake Stripe, leads against a fake Notion
npm run build
```

`vercel dev` runs the site and the `/api` functions together.
