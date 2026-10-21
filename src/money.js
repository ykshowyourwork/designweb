export const money = (cents) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const day = (unix) => new Date(unix * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const LABEL = { deposit: "Deposit", balance: "Balance at launch", other: "Payment" };
