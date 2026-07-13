const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:4321";
const CSV = "D:/AutoML/sample.csv";
const OUT = "D:/AutoML/_qa/shots";

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("theme", t);
  }, theme);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text()); });
  page.on("pageerror", (e) => console.log("PAGE ERR:", e.message));

  // 1. Empty dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("input[type=file]", { state: "attached", timeout: 20000 });
  await page.waitForTimeout(600);
  await setTheme(page, "light");
  await page.waitForTimeout(400);
  await shot(page, "01-empty-light");
  await setTheme(page, "dark");
  await page.waitForTimeout(400);
  await shot(page, "01-empty-dark");

  // 2. Upload + profile
  await page.locator("input[type=file]").first().setInputFiles(CSV);
  await page.getByText("Numeric correlation", { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(900); // let reveal anim settle
  await setTheme(page, "light");
  await page.waitForTimeout(300);
  await shot(page, "02-profiled-light");
  await setTheme(page, "dark");
  await page.waitForTimeout(300);
  await shot(page, "02-profiled-dark");

  // 3. Train (target defaults to suggested = subscribed)
  await page.getByRole("button", { name: /train models/i }).click();
  await page.getByText("won on", { exact: false }).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(1200);
  await setTheme(page, "light");
  await page.waitForTimeout(300);
  await shot(page, "03-results-light");
  await setTheme(page, "dark");
  await page.waitForTimeout(300);
  await shot(page, "03-results-dark");

  // 4. Visualizations section in view
  await page.locator("#visualizations").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await setTheme(page, "light");
  await page.waitForTimeout(300);
  await shot(page, "04-viz-light");
  await setTheme(page, "dark");
  await page.waitForTimeout(300);
  await shot(page, "04-viz-dark");

  // 5. Reports page (run should appear)
  await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await setTheme(page, "light");
  await page.waitForTimeout(300);
  await shot(page, "05-reports-light");
  await setTheme(page, "dark");
  await page.waitForTimeout(300);
  await shot(page, "05-reports-dark");

  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
