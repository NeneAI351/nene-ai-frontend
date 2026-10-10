import { readFileSync } from "node:fs";

const files = ["auth.js", "auth-config.js", "sw.js"];
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
