import Stripe from "stripe";

let client;
export const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
