/**
 * Drives the real dashboard in a browser: sign in, create a client, edit the
 * site, publish it, and open the published page. Proves the server actions,
 * the publish pipeline and the local host all work together.
 *
 *   npm start & npx tsx scripts/e2e.mts
 *
 * BASE_URL defaults to http://localhost:3100. Screenshots land in .data/e2e/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@localhost";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "photosite";
const SHOTS = path.join(process.cwd(), ".data", "e2e");

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}`);
  if (!condition) failures++;
}

await fs.mkdir(SHOTS, { recursive: true });
// CHROME_PATH lets this run against a preinstalled browser whose build number
// does not match the npm package's expectation.
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// --- sign in ---------------------------------------------------------------
await page.goto(`${BASE}/`);
check("unauthenticated visit lands on the login page", page.url().includes("/login"));
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`);
check("signed in and redirected to the overview", page.url() === `${BASE}/`);
await page.screenshot({ path: path.join(SHOTS, "01-overview.png") });

// --- create a client -------------------------------------------------------
const business = `E2E Photography ${Date.now().toString(36)}`;
await page.goto(`${BASE}/clients`);
await page.fill('input[name="name"]', "E2E Tester");
await page.fill('input[name="email"]', "e2e@example.com");
await page.fill('input[name="businessName"]', business);
// Scoped on purpose: the sidebar's "Sign out" is also a submit button.
await page.click('button:text-is("Create client and site")');
await page.waitForURL(/\/sites\//);
const siteUrl = page.url();
const siteId = siteUrl.split("/sites/")[1];
check("creating a client opens its new site editor", !!siteId);

// --- preview renders the starter content -----------------------------------
const previewRes = await page.request.get(`${BASE}/api/sites/${siteId}/preview`);
const previewHtml = await previewRes.text();
check("preview endpoint returns html", previewRes.status() === 200);
check("preview contains the business name", previewHtml.includes(business));
check("preview is noindex", previewHtml.includes("noindex"));

// --- edit and save ---------------------------------------------------------
const heroTitle = page.locator('section:has(h3:text-is("Hero")) input').first();
await heroTitle.fill("Edited by the e2e run");
await page.click('button:text-is("Save draft")');
await page.waitForSelector("text=Saved. Preview updated.", { timeout: 15000 });
check("saving the draft reports success", true);
await page.screenshot({ path: path.join(SHOTS, "02-editor.png"), fullPage: false });

// --- publish ---------------------------------------------------------------
await page.click('button:text-is("Publish")');
await page.waitForSelector('text=/last deploy: (success|failed)/', { timeout: 30000 });
// innerText comes back CSS-uppercased from the badge, so compare lowercased.
const deployBadge = (await page.locator("text=/last deploy: /").first().innerText()).toLowerCase();
check(`publish succeeded (${deployBadge})`, deployBadge.includes("success"));

// --- the published site is actually served ---------------------------------
await page.goto(`${BASE}/deployments`);
const liveHref = await page.locator('a[href^="/host/"]').first().getAttribute("href");
check("deployments list links to the published site", !!liveHref);
if (liveHref) {
  await page.goto(`${BASE}${liveHref}`);
  const body = await page.content();
  check("published page shows the edited hero title", body.includes("Edited by the e2e run"));
  check("published page has structured data", body.includes("application/ld+json"));
  await page.screenshot({ path: path.join(SHOTS, "03-published-site.png"), fullPage: false });
}

await browser.close();
console.log(`\nscreenshots in ${SHOTS}`);
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
