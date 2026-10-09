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
const aim = page => page.waitForFunction(() => {
  const position = Number(document.querySelector("#fishSkillGauge")?.dataset.position);
  return document.querySelector("#fishingPanel")?.dataset.phase === "bite" && position > .46 && position < .54;
}, {}, { timeout: 8000 });
const chips = async page => Number((await page.locator("#fishingPanel p").innerText()).match(/\+(\d+) ชิป/)?.[1]);
const balance = (page, value) => page.waitForFunction(amount => document.querySelector("#casinoToolbar")?.textContent.includes("ชิป " + amount + " ·"), value);
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
  await page.locator("#fishSkillGauge").waitFor({ state: "visible" });
  assert.equal(await page.locator("#fishTarget").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(237, 102, 116)");
  assert.equal(await page.locator("#fishRates > div > span").count(), 20);
  await page.screenshot({ path: "/tmp/ro-lounge-fishing-bite.png" });
  await aim(page);
  await page.keyboard.press("Space");
  await phase(page, "result");
  await page.waitForFunction(() => document.querySelector("#fishBag summary")?.textContent.includes("ปลา 1"));
  assert.match(await page.locator("#fishingPanel p").innerText(), /ได้.*ซม/);
  const reward = await chips(page);
  assert.ok(reward >= 1 && reward <= 20);
  await balance(page, 100 + reward);
  await page.keyboard.press("Space");
  assert.match(await page.locator("#fishBag summary").innerText(), /ปลา 1/); // No duplicate award.
  await balance(page, 100 + reward);
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
  await page.waitForFunction(() => Number(document.querySelector("#fishSkillGauge")?.dataset.position) > .88);
  await page.keyboard.press("Space");
  await phase(page, "result");
  assert.match(await page.locator("#fishingPanel p").innerText(), /ไม่ตรงแถบแดง/);
  await balance(page, 100 + reward);
  await phase(page, "idle");
  await page.keyboard.press("Space");
  await phase(page, "bite");
  await phase(page, "result"); // Let the reaction timer expire.
  assert.match(await page.locator("#fishingPanel p").innerText(), /ปลาหลุด/);
  await balance(page, 100 + reward);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700); // Let Phaser resize and smoothly recenter its follow camera.
  await phase(page, "idle");
  await page.locator("#fishAction").click();
  await phase(page, "bite");
  await page.screenshot({ path: "/tmp/ro-lounge-fishing-mobile.png" });
  await aim(page);
  await page.locator("#fishAction").click();
  await phase(page, "result");
  const mobileReward = await chips(page);
  assert.ok(mobileReward >= 1 && mobileReward <= 20);
  await balance(page, 100 + reward + mobileReward);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // Catch inventory lives on the server, keyed by the guest UUID.
  await page.reload();
  await page.getByRole("button", { name: "เข้าเมือง", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#fishBag summary")?.textContent.includes("ปลา 2"));
  assert.equal(await page.locator("#fishingPanel").getAttribute("data-phase"), "idle");
  await balance(page, 100 + reward + mobileReward);
  assert.deepEqual(errors, []);
  console.log("PASS: shared wildlife/weather, red-zone gauge Space/mobile hits, 1–20 rewards, early/gauge/late misses, no replay, chat-safe keyboard, rates, wallet/inventory after refresh");
} finally {
  await browser.close();
}
