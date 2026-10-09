import { chromium } from "playwright";
import assert from "node:assert/strict";

// Run alongside server + Vite. Separate contexts simulate separate guests on one Wi-Fi.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";
const errors = [];
async function guest(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" || message.type() === "warning") console.log("browser:", message.text()); });
  await page.goto(url);
  await page.locator("#nameInput").fill(name);
  await page.getByRole("button", { name: "เข้าเมือง", exact: true }).click();
  await page.locator("#casinoToolbar").waitFor();
  await page.waitForFunction(() => document.querySelector("#casinoToolbar")?.textContent.includes("ชิป 100"));
  return { page, context };
}
async function enter(page, seat = 0) {
  await page.getByRole("button", { name: "♠ ไปบ้านป๊อกเด้ง", exact: true }).click();
  try { await page.locator('[data-seat="' + seat + '"]').waitFor({ timeout: 20000 }); }
  catch (error) {
    await page.screenshot({ path: "/tmp/ro-lounge-failure.png" });
    console.log("entry diagnostics:", await page.locator("#status").textContent(), await page.locator("#pokNotice").textContent());
    throw error;
  }
  await page.waitForFunction(index => !document.querySelector('[data-seat="' + index + '"]')?.disabled, seat);
}
try {
  const dealer = await guest("Dealer QA");
  const player = await guest("Player QA");
  await dealer.page.screenshot({ path: "/tmp/ro-lounge-town.png" });
  await enter(dealer.page);
  await dealer.page.locator('[data-seat="0"]').click();
  await dealer.page.locator(".pok-seat.mine").waitFor();
  await enter(player.page, 1);
  await player.page.locator('[data-seat="1"]').click();
  await player.page.locator("#pokBetAmount").waitFor();
  assert.match(await player.page.locator("#pokWallet").innerText(), /100 ชิป/);
  assert.match(await dealer.page.locator("#pokBetSummary").innerText(), /เจ้ามือไม่ต้องลงเดิมพันเอง/);
  const betPosition = await player.page.locator("#pokBetAmount").boundingBox();
  const seatPosition = await player.page.locator("#pokSeats").boundingBox();
  assert.ok(betPosition.y < seatPosition.y, "betting must be prominent above the seats");
  await player.page.getByRole("button", { name: "ลงเดิมพัน", exact: true }).click();
  await player.page.waitForFunction(() => document.querySelector("#casinoToolbar")?.textContent.includes("สำรอง 50"));
  await dealer.page.getByRole("button", { name: "เริ่มเกม", exact: true }).click();
  await dealer.page.waitForFunction(() => document.querySelectorAll(".pok-seat.mine .pok-card").length === 2);
  await player.page.waitForFunction(() => document.querySelectorAll(".pok-seat.mine .pok-card").length === 2);
  assert.equal(await dealer.page.locator(".pok-seat.mine .back").count(), 0);
  assert.equal(await player.page.locator(".pok-seat.mine .back").count(), 0);
  await dealer.page.screenshot({ path: "/tmp/ro-lounge-table.png" });
  const firstRound = await dealer.page.locator("#pokPhase").innerText();
  // Refresh keeps guest credentials and reconnects into the retained round at the doorway.
  await player.page.reload();
  await player.page.getByRole("button", { name: "เข้าเมือง", exact: true }).click();
  await player.page.locator(".pok-seat.mine").waitFor({ timeout: 20000 });
  assert.match(await player.page.locator(".pok-seat.mine").innerText(), /Player QA/);
  const ending = [];
  for (const page of [dealer.page, player.page]) {
    ending.push(page.waitForFunction(() => document.querySelector("#pokPhase")?.textContent.includes("เปิดไพ่"), { timeout: 20000 }));
  }
  // Let the server exercise automatic actions, including forced draws below four.
  await Promise.all(ending);
  assert.ok(await dealer.page.locator(".pok-result").filter({ hasText: "ชิป" }).count() >= 2);
  assert.equal(await dealer.page.locator(".back").count(), 0);
  await player.page.setViewportSize({ width: 390, height: 844 });
  await player.page.screenshot({ path: "/tmp/ro-lounge-table-mobile.png", fullPage: true });
  assert.equal(await player.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await player.page.waitForFunction(() => document.querySelector("#pokPhase")?.textContent.includes("เลือกที่นั่ง"), null, { timeout: 12000 });
  assert.match(await player.page.locator("#pokBetSummary").innerText(), /เดิมพันที่ยืนยัน: 10 ชิป/);
  assert.match(await player.page.locator("#pokWallet").innerText(), /ตาล่าสุด/);
  // No second click on Start: the next hand must be dealt after the betting countdown.
  await dealer.page.waitForFunction(first => {
    const phase = document.querySelector("#pokPhase")?.textContent ?? "";
    return phase.includes("กำลังแจก") && phase !== first;
  }, firstRound, { timeout: 15000 });
  assert.match(await dealer.page.locator("#pokPhase").innerText(), /ตาที่ 2/);
  await player.page.getByRole("button", { name: "ออกสู่เมือง", exact: true }).click();
  assert.match(await player.page.locator("#pokNotice").innerText(), /รอคิดชิป/);
  await player.page.waitForFunction(() => document.querySelector("#casino")?.hidden === true, null, { timeout: 30000 });
  await dealer.page.waitForFunction(() => document.querySelector("#pokAutoStatus")?.textContent.includes("รอลูกมือลงเดิมพัน"));
  await dealer.page.getByRole("button", { name: "ออกสู่เมือง", exact: true }).click();
  await dealer.page.waitForFunction(() => document.querySelector("#casino")?.hidden === true, null, { timeout: 30000 });
  assert.deepEqual(errors, []);
  console.log("PASS: prominent betting/wallet, private cards, refresh, payouts, mobile, automatic second round and queued exit");
} finally {
  await browser.close();
}
