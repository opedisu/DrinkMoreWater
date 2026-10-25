#!/usr/bin/env node
/**
 * Renders every app icon from public/icons/icon.svg.
 *
 * The icons used to be five opaque PNGs with no source, so the logo could
 * only be replaced, never edited. Now the SVG is the source and this
 * regenerates the set:
 *
 *   node scripts/make-icons.mjs
 *
 * sharp is not a declared dependency: it resolves through Next, which
 * bundles it. If that ever stops being true, npm i -D sharp.
 *
 * Three shapes, because the platforms want different things:
 *   any       full bleed, the OS applies its own corner rounding
 *   maskable  the mark inside the safe zone, since Android crops to a
 *             circle or a squircle and would otherwise clip it
 *   badge     a white silhouette on transparent, because Android draws
 *             the notification badge as a mask and discards colour
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const icons = join(here, "..", "public", "icons");

const source = await readFile(join(icons, "icon.svg"), "utf8");

/** Shrinks the mark so a circular Android mask cannot clip it. */
function withSafeZone(svg) {
    return svg.replace(
        '<rect width="512" height="512" fill="#03101c"/>',
        '<rect width="512" height="512" fill="#03101c"/>\n  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">'
    ).replace("</svg>", "  </g>\n</svg>");
}

/** White on transparent: Android keeps the alpha and throws the rest away. */
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="170" y="104" width="172" height="304" rx="50" fill="none" stroke="#ffffff" stroke-width="26"/>
  <rect x="192" y="228" width="128" height="158" rx="30" fill="#ffffff"/>
</svg>`;

const jobs = [
    ["icon-192.png", source, 192],
    ["icon-512.png", source, 512],
    ["apple-touch-icon.png", source, 180],
    ["maskable-512.png", withSafeZone(source), 512],
    ["badge-96.png", badge, 96]
];

for (const [name, svg, size] of jobs) {
    const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    await writeFile(join(icons, name), png);
    console.log(`  ${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log("\nIcons rebuilt from icon.svg.");
