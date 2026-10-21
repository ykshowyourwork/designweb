import { defineConfig } from "vite";
import { resolve } from "node:path";
import brand from "./brand.json" with { type: "json" };

// Every page writes the business name and contact details as %name%, %email%…
// so renaming the business is one edit to brand.json.
const fill = (html) =>
  html.replace(/%(\w+)%/g, (m, key) => {
    if (key === "callHref") return brand.callUrl || `mailto:${brand.email}?subject=${encodeURIComponent("Website call")}`;
    if (key === "year") return String(new Date().getFullYear());
    return key in brand ? String(brand[key]) : m;
  });

export default defineConfig({
  plugins: [{ name: "brand", transformIndexHtml: fill }],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        invoice: resolve(import.meta.dirname, "invoice.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
      },
    },
  },
});
