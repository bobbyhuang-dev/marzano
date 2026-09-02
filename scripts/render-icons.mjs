// Renders the favicon set in public/ from the mark in src/lib/brand.ts.
// Run it as `pnpm icons` after changing the mark. The outputs are committed
// because the deploy has no step for this, and the SVG alone cannot serve
// Safari, iOS or the web app manifest.
//
// Imports a .ts file directly, so it needs a Node that strips types; the
// pinned 24 does.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

import { BRAND_MARK_BOUNDS, BRAND_MARK_PATH } from "../src/lib/brand.ts";

const PUBLIC = new URL("../public/", import.meta.url);

// Graphite, the default accent: the primary surface of each theme.
const LIGHT = "#141414";
const DARK = "#f5f5f5";

// The tile behind the mark on a home screen. iOS paints black behind anything
// transparent and rounds the corners itself, so it is opaque and square.
const TILE = "#141414";
const TILE_MARK = "#fafafa";
// How much of a tile the mark spans. Android's maskable icons keep only the
// central 80% circle, and at this size the leaf tips and the bottom of the
// body stay inside it.
const TILE_SCALE = 0.64;
const MARK_CENTRE = {
  x: BRAND_MARK_BOUNDS.x + BRAND_MARK_BOUNDS.width / 2,
  y: BRAND_MARK_BOUNDS.y + BRAND_MARK_BOUNDS.height / 2,
};

const ICO_SIZES = [16, 32, 48];
const APPLE_TOUCH_SIZE = 180;
const MANIFEST_SIZES = [192, 512];

// The favicon keeps the full 64-unit square rather than the mark's tight
// bounds: a tab icon wants a little air around it, and the ICO below is
// rasterised square from this same string.
function markSvg({ adaptive }) {
  const style = adaptive
    ? `<style>path{fill:${LIGHT}}@media (prefers-color-scheme:dark){path{fill:${DARK}}}</style>`
    : "";
  const fill = adaptive ? "" : ` fill="${LIGHT}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${style}<path${fill} d="${BRAND_MARK_PATH}"/></svg>\n`;
}

function tileSvg(size) {
  const scale = (size * TILE_SCALE) / 64;
  const tx = size / 2 - MARK_CENTRE.x * scale;
  const ty = size / 2 - MARK_CENTRE.y * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${TILE}"/><g transform="translate(${tx} ${ty}) scale(${scale})"><path fill="${TILE_MARK}" d="${BRAND_MARK_PATH}"/></g></svg>`;
}

function png(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

// An ICO is a directory of images; PNG entries have been valid since Vista and
// every browser reads them, so there is no bitmap encoding to get right.
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;
  entries.forEach(({ size, data }, index) => {
    const entry = directory.subarray(index * 16, index * 16 + 16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.data)]);
}

await mkdir(PUBLIC, { recursive: true });
const write = (name, data) => writeFile(new URL(name, PUBLIC), data);

await write("favicon.svg", markSvg({ adaptive: true }));

// The ICO cannot follow the colour scheme, so it is the light mark.
const icoEntries = await Promise.all(
  ICO_SIZES.map(async (size) => ({
    size,
    data: await png(markSvg({ adaptive: false }), size),
  })),
);
await write("favicon.ico", ico(icoEntries));

await write("apple-touch-icon.png", await png(tileSvg(APPLE_TOUCH_SIZE), APPLE_TOUCH_SIZE));
for (const size of MANIFEST_SIZES) {
  await write(`icon-${size}.png`, await png(tileSvg(size), size));
}

console.log(
  `Rendered favicon.svg, favicon.ico (${ICO_SIZES.join("/")}), apple-touch-icon.png and icon-{${MANIFEST_SIZES.join(",")}}.png into public/.`,
);
