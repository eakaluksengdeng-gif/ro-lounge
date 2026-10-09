import { chromium } from "playwright";
import assert from "node:assert/strict";

const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
async function join(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  await page.locator("#nameInput").fill(name);
  await page.getByRole("button", { name: "เข้าเมือง", exact: true }).click();
  await page.locator("#natureBar").waitFor();
  await page.waitForFunction(() => document.querySelector("#townWeather")?.dataset.wildlife === "13");
  return page;
}
const phase = (page, value) => page.waitForFunction(expected => document.querySelector("#fishingPanel")?.dataset.phase === expected, value, { timeout: 15000 });
try {
  const page = await join("Fishing QA");
  await page.waitForFunction(() => document.querySelector("#casinoToolbar")?.textContent.includes("ชิป 100"));
  const spectator = await join("Nature QA");
  if (!process.env.E2E_URL) {
    // Local server: RO_WEATHER_PHASE_MS=5000. Observe real server-synchronized weather, not a UI override.
    for (const kind of ["sunny", "rain", "snow"]) {
      await page.waitForFunction(k => document.querySelector("#townWeather")?.dataset.kind === k, kind, { timeout: 20000 });
      await spectator.waitForFunction(k => document.querySelector("#townWeather")?.dataset.kind === k, kind);
      await page.screenshot({ path: "/tmp/ro-lounge-nature-" + kind + ".png" });
    }
  }
  await page.getByRole("button", { name: "🐟 ไปบ่อตกปลา", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#fishingPanel")?.dataset.near === "true", {}, { timeout: 15000 });
  await page.keyboard.press("Space"); // Keep focus on the travel button: Space still casts.
  await phase(page, "waiting");
  await page.locator("#chatInput").focus();
  await page.keyboard.press("Space");
  await phase(page, "waiting"); // Typing a space must not reel or cancel the cast.
  await page.locator("#chatInput").blur();
  await phase(page, "bite");
  await page.screenshot({ path: "/tmp/ro-lounge-fishing-bite.png" });
  await page.keyboard.press("Space");
  await phase(page, "result");
  await page.waitForFunction(() => document.querySelector("#fishBag summary")?.textContent.includes("ปลา 1"));
  assert.match(await page.locator("#fishingPanel p").innerText(), /ได้.*ซม/);
  assert.match(await page.locator("#fishingPanel p").innerText(), /\+10 ชิป/);
  await page.waitForFunction(() => document.querySelector("#casinoToolbar")?.textContent.includes("ชิป 110"));
  await page.keyboard.press("Space");
  assert.match(await page.locator("#fishBag summary").innerText(), /ปลา 1/); // No duplicate award.
  assert.match(await page.locator("#casinoToolbar").innerText(), /ชิป 110/);
  await phase(page, "idle");
  await page.keyboard.press("Space");
  await phase(page, "waiting");
  await page.keyboard.press("Space");
  await phase(page, "result");
  assert.match(await page.locator("#fishingPanel p").innerText(), /เร็วไป/);
  assert.match(await page.locator("#fishBag summary").innerText(), /ปลา 1/);
  await phase(page, "idle");
  await page.keyboard.press("Space");
  await phase(page, "bite");
  await phase(page, "result"); // Let the reaction timer expire.
  assert.match(await page.locator("#fishingPanel p").innerText(), /ปลาหลุด/);
  assert.match(await page.locator("#casinoToolbar").innerText(), /ชิป 110/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700); // Let Phaser resize and smoothly recenter its follow camera.
  await page.screenshot({ path: "/tmp/ro-lounge-fishing-mobile.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // Catch inventory lives on the server, keyed by the guest UUID.
  await page.reload();
  await page.getByRole("button", { name: "เข้าเมือง", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#fishBag summary")?.textContent.includes("ปลา 1"));
  assert.equal(await page.locator("#fishingPanel").getAttribute("data-phase"), "idle");
  await page.waitForFunction(() => document.querySelector("#casinoToolbar")?.textContent.includes("ชิป 110"));
  assert.deepEqual(errors, []);
  console.log("PASS: shared 13 wildlife/weather, Space fishing +10 chips, chat-safe keyboard, early/late miss, no duplicate reward, mobile, wallet/inventory after refresh");
} finally {
  await browser.close();
}
