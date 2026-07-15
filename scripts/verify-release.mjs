import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodeRgbaPng(buffer) {
  assert.ok(buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), "maskable icon must be a PNG");

  let offset = PNG_SIGNATURE.length;
  let width;
  let height;
  const imageData = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "maskable PNG must use 8-bit channels");
      assert.equal(data[9], 6, "maskable PNG must use RGBA colour");
      assert.equal(data[12], 0, "maskable PNG must be non-interlaced");
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  assert.equal(width, 512, "maskable PNG width must be 512 pixels");
  assert.equal(height, 512, "maskable PNG height must be 512 pixels");

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const encoded = inflateSync(Buffer.concat(imageData));
  assert.equal(encoded.length, height * (rowLength + 1), "maskable PNG scanlines are malformed");
  const pixels = Buffer.alloc(width * height * bytesPerPixel);

  for (let y = 0; y < height; y += 1) {
    const encodedRow = y * (rowLength + 1);
    const decodedRow = y * rowLength;
    const filter = encoded[encodedRow];
    for (let x = 0; x < rowLength; x += 1) {
      const raw = encoded[encodedRow + x + 1];
      const left = x >= bytesPerPixel ? pixels[decodedRow + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[decodedRow - rowLength + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[decodedRow - rowLength + x - bytesPerPixel]
        : 0;

      let reconstructed;
      if (filter === 0) reconstructed = raw;
      else if (filter === 1) reconstructed = raw + left;
      else if (filter === 2) reconstructed = raw + above;
      else if (filter === 3) reconstructed = raw + Math.floor((left + above) / 2);
      else if (filter === 4) reconstructed = raw + paeth(left, above, upperLeft);
      else assert.fail(`unsupported PNG filter ${filter}`);
      pixels[decodedRow + x] = reconstructed & 0xff;
    }
  }

  return { height, pixels, width };
}

const requiredDistFiles = [
  "dist/index.html",
  "dist/manifest.webmanifest",
  "dist/sw.js",
  "dist/version.json",
  "dist/classbud-maskable.svg",
  "dist/classbud-maskable-512.png",
];
const builtFiles = await Promise.all(requiredDistFiles.map((path) => readFile(path)));
const [, manifestBytes, serviceWorkerBytes, , maskableSvgBytes, maskablePngBytes] = builtFiles;

const manifest = JSON.parse(manifestBytes.toString("utf8"));
const maskableIcons = manifest.icons.filter((icon) => icon.purpose?.split(/\s+/u).includes("maskable"));
assert.ok(
  maskableIcons.some((icon) => icon.src === "/classbud-maskable-512.png" && icon.sizes === "512x512" && icon.type === "image/png"),
  "manifest must include the 512px maskable PNG",
);
assert.ok(
  maskableIcons.some((icon) => icon.src === "/classbud-maskable.svg" && icon.sizes === "any" && icon.type === "image/svg+xml"),
  "manifest must include the maskable SVG",
);

const maskableSvg = maskableSvgBytes.toString("utf8");
assert.match(maskableSvg, /<rect width="512" height="512" fill=/u, "maskable SVG must paint the full canvas");

const regularPng = await readFile("dist/classbud-512.png");
assert.ok(!regularPng.equals(maskablePngBytes), "maskable PNG must not reuse the transparent-corner app icon");
const { pixels } = decodeRgbaPng(maskablePngBytes);
for (let index = 3; index < pixels.length; index += 4) {
  assert.equal(pixels[index], 255, "maskable PNG must be opaque across the complete canvas");
}

const serviceWorker = serviceWorkerBytes.toString("utf8");
assert.match(serviceWorker, /precacheAndRoute/u, "service worker must install a Workbox precache");
assert.match(serviceWorker, /index\.html/u, "service worker precache must include the app shell");

const netlify = await readFile("netlify.toml", "utf8");
assert.match(netlify, /command = "npm run check"/u, "Netlify must run the release check");
const headerBlocks = netlify.split("[[headers]]").slice(1);
const securedRoutes = ["/index.html", "/assets/*", "/sw.js", "/manifest.webmanifest", "/version.json", "/*"];
const securityHeaders = [
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
];
for (const route of securedRoutes) {
  const block = headerBlocks.find((candidate) => candidate.includes(`for = "${route}"`));
  assert.ok(block, `Netlify header block is missing for ${route}`);
  for (const header of securityHeaders) {
    assert.ok(block.includes(`${header} =`), `${route} must receive ${header}`);
  }
}

console.log("Release artifact verification passed.");
