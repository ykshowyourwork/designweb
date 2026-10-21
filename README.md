# DesignWeb

Sales site and invoice payments for the website business. "DesignWeb" is a working name: change it in `brand.json` and every page follows.

- `/` the sales site (static HTML, Google and AI ready: meta tags, Schema, FAQ)
- `/invoice/<token>` a client's invoice: deposit and balance, paid by card through Stripe
- `/admin` make invoices, see who paid, send the balance on launch day

No database. Each project is a Stripe customer with two invoices: the deposit is emailed right away, the balance is held as a draft until you press **Send balance**. Stripe sends the emails, takes the card, sends receipts and reminders.

## Settings

`brand.json`: name, tagline, domain, contact email, `callUrl` (a Calendly or booking link; empty = the email).

Vercel environment variables:

| Name | What |
| --- | --- |
| `STRIPE_SECRET_KEY` | The business's Stripe secret key (`sk_live_…`, or `sk_test_…` to try it) |
| `ADMIN_PASSWORD` | Password for `/admin`, 8+ characters |
| `SITE_URL` | Optional. Defaults to `https://<domain from brand.json>` |

In Stripe → Settings → Branding, set the business name, logo and color: that's what clients see on the invoice emails and the pay page. Stripe only emails invoices in live mode.

## Run it

```
npm install
npm test        # invoice logic against a fake Stripe
npm run build
```

`vercel dev` runs the site and the `/api` functions together.
