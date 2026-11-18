// Renders public/icons/icon.svg to the PNG sizes Android/iOS need (uses the preinstalled Playwright Chromium).
import { readFileSync } from "fs";
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium } = pw;
const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  ["icon-192.png", 192, false], ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, false],
];
for (const [name, size, maskable] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? svg.replace('rx="112"', 'rx="0"') : svg;
  const pad = maskable ? size * 0.1 : 0;
  await page.setContent(`<html><body style="margin:0;background:${maskable ? "#5b4be0" : "transparent"}"><div style="padding:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px">${inner.replace("<svg ", `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !maskable });
}
await browser.close();
console.log("icons written");
