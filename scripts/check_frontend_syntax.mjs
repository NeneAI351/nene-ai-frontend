import { readFileSync } from "node:fs";

// The browser cannot offer the intended PWA installation metadata when the
// manifest is invalid JSON or its referenced PNG icons have the wrong size.
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
if (!manifest.name || !manifest.start_url || manifest.display !== "standalone") {
  throw new Error("Installation manifest is missing required app metadata");
}
for (const size of [192, 512]) {
  const icon = manifest.icons?.find(item => item.sizes === `${size}x${size}` && item.type === "image/png");
  if (!icon || !/^\.\/[A-Za-z0-9_-]+\.png$/.test(icon.src)) {
    throw new Error(`Missing local ${size}px PNG installation icon`);
  }
  const png = readFileSync(icon.src);
  if (png.length < 24 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
    throw new Error(`Invalid PNG dimensions for ${icon.src}`);
  }
}
console.log("Installation manifest and PNG icon dimensions OK");

const files = ["auth.js", "auth-config.js", "sw.js", "director.js", "paid-access.js", "account-setup.js", "ad-studio.js"];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  new Function(source);
  console.log("Syntax OK:", file);
}

const html = readFileSync("index.html", "utf8");
const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let inlineCount = 0;
for (let i = 0; i < tags.length; i += 1) {
  const attributes = tags[i][1];
  const source = tags[i][2];
  if (/\bsrc\s*=/.test(attributes) || !source.trim()) continue;
  try {
    new Function(source);
  } catch (error) {
    throw new Error("Inline script " + i + " failed syntax validation: " + error.message);
  }
  inlineCount += 1;
}
console.log("Syntax OK:", inlineCount, "inline scripts in index.html");

// Every local entry module must be precached at the same version as the page.
const worker = readFileSync("sw.js", "utf8");
for (const match of html.matchAll(/<script\b[^>]*\bsrc="(\.\/[^" ]+)"/gi)) {
  if (!worker.includes("'" + match[1] + "'")) {
    throw new Error("Service worker does not precache current script: " + match[1]);
  }
}
if (!worker.includes("'./terms.html'")) throw new Error("Agreement document is missing from the app cache");
console.log("Service-worker entry modules and agreement document OK");
