# DesignWeb

Sales site and invoice payments for the website business. "DesignWeb" is a working name: change it in `brand.json` and every page follows.

- `/` the sales site, plus How it works, What you get, Pricing, Industries (one page per trade), Examples, FAQ, About and Free mockup. Static HTML, Google and AI ready: meta tags, Schema, sitemap, llms.txt
- `/free-mockup` the lead form: every request becomes a row in the Notion database "DesignWeb Inbound Leads"
- `/invoice/<token>` a client's invoice: deposit and balance, paid by card through Stripe
- `/admin` make invoices, see who paid, send the balance on launch day

No database. Each project is a Stripe customer with two invoices: the deposit is emailed right away, the balance is held as a draft until you press **Send balance**. Stripe sends the emails, takes the card, sends receipts and reminders.

## Changing the site

| To change | Edit |
| --- | --- |
| Business name, domain, email, booking link | `brand.json` |
| Add or edit a trade page | `content/industries.json` (pages, links, sitemap all follow) |
| Header, footer, pricing, FAQ, steps | the matching file in `partials/` (shared by every page) |
| One page's own text | that page's `index.html` (e.g. `pricing/index.html`) |

`scripts/build-pages.js` writes the industry pages, `sitemap.xml` and `llms.txt` before every `dev` and `build`; don't edit those outputs.

## Settings

`brand.json`: name, tagline, domain, contact email, `callUrl` (a Calendly or booking link; empty = the email).

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
