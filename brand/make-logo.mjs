// Final DesiWeb logo: the "d." tile + "DesiWeb." wordmark, as pure SVG paths.
// Usage: node final.mjs <dir with deps/> <output dir>
import fs from "node:fs";
import path from "node:path";
import opentype from "./deps/node_modules/opentype.js/dist/opentype.module.js";
const [, , base, out] = process.argv;
const b = fs.readFileSync(path.join(base, "deps/node_modules/@fontsource/inter/files/inter-latin-800-normal.woff"));
const F = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const BLUE = "#1f5eff";

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

const dGlyph = text("d", 46, 0, 0, 0);
const tile = `<rect width="64" height="64" rx="16" fill="${BLUE}"/><path transform="translate(${(64 - dGlyph.width) / 2 - 4} 48)" fill="#fff" d="${dGlyph.d}"/><circle cx="${(64 + dGlyph.width) / 2 + 4}" cy="45" r="4.6" fill="#fff" fill-opacity=".7"/>`;

const word = text("DesiWeb", 44, 78, 47);
const end = 78 + word.width;
const W = Math.ceil(end + 14);
const lockup = (ink) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 64" role="img" aria-label="DesiWeb">${tile}<path fill="${ink}" d="${word.d}"/><circle cx="${(end + 6.5).toFixed(2)}" cy="42.5" r="5" fill="${BLUE}"/></svg>`;

fs.writeFileSync(`${out}/logo.svg`, lockup("#111110"));
fs.writeFileSync(`${out}/logo-white.svg`, lockup("#ffffff"));
fs.writeFileSync(`${out}/logo-current.svg`, lockup("currentColor"));
fs.writeFileSync(`${out}/icon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${tile}</svg>`);
fs.writeFileSync(`${out}/size.json`, JSON.stringify({ width: W, height: 64 }));
console.log("width", W);
