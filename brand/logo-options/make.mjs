// Builds DesiWeb logo options as pure SVG paths (no font needed to view them).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(path.join(process.argv[2], "deps/package.json"));
const opentype = require("opentype.js");
const out = process.argv[2];
const font = (f) => opentype.parse(fs.readFileSync(require.resolve(`@fontsource/${f}`)).buffer.slice(0));
const inter = (w) => { const b = fs.readFileSync(path.join(out, `deps/node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const F = inter(800);

const BLUE = "#1f5eff", INK = "#111110";

// Lays out text glyph by glyph with tracking; returns {d, width}.
function text(str, size, x, y, track = -0.035) {
  const scale = size / F.unitsPerEm;
  const glyphs = F.stringToGlyphs(str);
  let pen = x, d = "";
  glyphs.forEach((g, i) => {
    d += g.getPath(pen, y, size).toPathData(2);
    pen += g.advanceWidth * scale + size * track;
    if (glyphs[i + 1]) pen += F.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { d, width: pen - x - size * track };
}

const marks = {
  // A: a map pin. Found locally.
  pin: (fg, bg) => `<path fill="${BLUE}" d="M32 61C32 61 11 41 11 25.5a21 21 0 1 1 42 0C53 41 32 61 32 61Z"/><circle cx="32" cy="25.5" r="8.5" fill="${bg}"/>`,
  // B: lowercase d in a blue tile, with the period.
  tile: (fg, bg) => { const t = text("d", 46, 0, 0, 0); const w = t.width; return `<rect width="64" height="64" rx="16" fill="${BLUE}"/><g transform="translate(${(64 - w) / 2 - 4} 48)"><path fill="#fff" d="${text("d", 46, 0, 0, 0).d}"/></g><circle cx="${(64 + w) / 2 + 4}" cy="45" r="4.6" fill="#fff" opacity=".7"/>`; },
  // C: the top search result. Three results, yours is first.
  top: (fg, bg) => `<rect width="64" height="64" rx="16" fill="${fg}"/><rect x="13" y="16" width="38" height="9" rx="4.5" fill="${BLUE}"/><rect x="13" y="30" width="28" height="7" rx="3.5" fill="${bg}" opacity=".55"/><rect x="13" y="42" width="20" height="7" rx="3.5" fill="${bg}" opacity=".3"/>`,
};

function lockup(mark, word, fg, bg, dot = false) {
  const size = 44, gap = 14;
  const t = text(word, size, 64 + gap, 47);
  const end = 64 + gap + t.width;
  const w = Math.ceil(end + (dot ? 14 : 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 64" width="${w * 2}" height="128">${marks[mark](fg, bg)}<path fill="${fg}" d="${t.d}"/>${dot ? `<circle cx="${end + 6.5}" cy="42.5" r="5" fill="${BLUE}"/>` : ""}</svg>`;
}
const icon = (mark, fg, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">${marks[mark](fg, bg)}</svg>`;

const opts = [
  ["a", "pin", "DesiWeb", false, "Pin: you, on the map"],
  ["b", "tile", "desiweb", true, "Tile: the d. monogram"],
  ["c", "top", "DesiWeb", false, "Top result: first in search"],
];
for (const [k, m, word, dot] of opts) {
  fs.writeFileSync(`${out}/${k}-light.svg`, lockup(m, word, INK, "#ffffff", dot));
  fs.writeFileSync(`${out}/${k}-dark.svg`, lockup(m, word, "#ffffff", "#111110", dot));
  fs.writeFileSync(`${out}/${k}-icon.svg`, icon(m, INK, "#ffffff"));
}
const row = ([k, , , , label], i) => `<div class="opt"><div class="lab">Option ${"ABC"[i]} · ${label}</div><div class="pair"><div class="l"><img src="${k}-light.svg"></div><div class="d"><img src="${k}-dark.svg"></div><div class="l ic"><img src="${k}-icon.svg" width="64"><img src="${k}-icon.svg" width="32"><img src="${k}-icon.svg" width="16"></div></div></div>`;
fs.writeFileSync(`${out}/preview.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:36px;background:#ecebe6;font:600 15px -apple-system,sans-serif;color:#555;width:1328px;box-sizing:border-box}.opt{margin-bottom:28px}.lab{margin:0 0 10px 4px}.pair{display:grid;grid-template-columns:1fr 1fr 190px;gap:12px}.pair>div{border-radius:14px;height:150px;display:flex;align-items:center;justify-content:center;gap:18px}.l{background:#fff}.d{background:#111110}.pair img{height:64px}.ic img{height:auto}</style>${opts.map(row).join("")}`);
console.log("ok");
