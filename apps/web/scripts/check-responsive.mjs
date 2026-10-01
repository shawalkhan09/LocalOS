// Responsive check. Usage: node scripts/check-responsive.mjs [baseUrl] [--shots]
// --shots also writes full-page PNGs to docs/design/screenshots/responsive/.
// Set APP_EMAIL and APP_PASSWORD (a local owner login) to also check the /dashboard routes.
import { chromium } from "../../../node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const shots = args.includes("--shots");
const base = (args.find((a) => a.startsWith("http")) || process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const PAGES = ["/", "/classes", "/trainers", "/membership", "/contact", "/book/session", "/book/class"];
const WIDTHS = [320, 375, 390, 414, 600, 768, 820, 1024, 1280, 1440, 1920, 2560];
const DASH = ["/dashboard", "/dashboard/customers", "/dashboard/new-booking", "/dashboard/schedule", "/dashboard/team", "/dashboard/staff", "/dashboard/services", "/dashboard/classes", "/dashboard/business-hours", "/dashboard/business-info", "/dashboard/membership-plans", "/dashboard/account"];
const authed = Boolean(process.env.APP_EMAIL && process.env.APP_PASSWORD);
const SHOT_WIDTHS = [320, 390, 768, 1024, 1440, 2560];
const SHOT_PAGES = ["/", "/classes", "/trainers", "/membership", "/contact", "/book/session"];
const VIEWPORTS = [...WIDTHS.map((w) => ({ w, h: 900 })), { w: 844, h: 390 }];
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/design/screenshots/responsive");
if (shots) mkdirSync(outDir, { recursive: true });
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));

const inspect = () => {
  const vw = window.innerWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (o.overflowX !== "visible" && p !== document.documentElement && p !== document.body) return true;
    }
    return false;
  };
  const desc = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} "${(el.textContent || "").trim().slice(0, 24)}"`;
  const overflow = [];
  const small = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clipped(el)) overflow.push(`${desc(el)} [${Math.round(r.left)},${Math.round(r.right)}]`);
    if (vw <= 820 && (el.tagName === "A" || el.tagName === "BUTTON") && r.height < 43.5) small.push(`${desc(el)} h=${Math.round(r.height)}`);
  }
  return { sw: document.documentElement.scrollWidth, vw, overflow: overflow.slice(0, 5), small: small.slice(0, 5) };
};

const browser = await chromium.launch();
// Sign in once and reuse the session: the API rate-limits logins per email and IP.
let session;
if (authed) {
  const lc = await browser.newContext();
  const lp = await lc.newPage();
  await lp.goto(base + "/login", { waitUntil: "networkidle" });
  await lp.fill("#email", process.env.APP_EMAIL);
  await lp.fill("#password", process.env.APP_PASSWORD);
  await lp.locator("button[type=submit]").click();
  await lp.waitForURL("**/dashboard");
  session = await lc.storageState();
  await lc.close();
}
const rows = [];
let hard = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w <= 820, storageState: session });
  const page = await ctx.newPage();
  for (const p of authed ? [...PAGES, ...DASH] : PAGES) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const r = await page.evaluate(inspect);
    const label = `${vp.w}x${vp.h} ${p}`;
    if (r.sw !== r.vw) { hard++; rows.push([label, "SCROLLWIDTH", `${r.sw} != ${r.vw}`]); }
    r.overflow.forEach((o) => rows.push([label, "overflow", o]));
    r.small.forEach((o) => rows.push([label, "tap<44", o]));
    if (shots && vp.h === 900 && SHOT_WIDTHS.includes(vp.w) && SHOT_PAGES.includes(p)) {
      await page.screenshot({ path: path.join(outDir, `${slug(p)}-${vp.w}.png`), fullPage: true });
    }
  }
  await ctx.close();
}
await browser.close();
console.log(rows.length ? rows.map((r) => r.join(" | ")).join("\n") : "no issues");
console.log(`\n${hard} scrollWidth failure(s), ${rows.length - hard} other note(s)`);
process.exit(hard ? 1 : 0);
