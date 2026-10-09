import { chromium } from "playwright";
import assert from "node:assert/strict";

// Local-only deterministic harness using the real CasinoUI, not a production route or fake server.
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173");
  await page.evaluate(async () => {
    const { CasinoUI } = await import("/src/pokdeng/CasinoUI.ts");
    document.body.replaceChildren();
    const listeners = new Map();
    const sent = [];
    const town = { state: {}, send() {}, onMessage(type, callback) { listeners.set(type, callback); } };
    const room = { send(type, body) { sent.push({ type, body }); } };
    const ui = new CasinoUI(town, { casinoOpen: true }, "นักตกปลา");
    ui.room = room;
    ui.playerId = "p3";
    ui.wallet = { balance: 123456789, available: 123456739, reserved: 50 };
    ui.modal.hidden = false;
    const seats = Array.from({ length: 8 }, (_, seat) => ({ seat, playerId: "p" + seat,
      name: ["เจ้ามือใจดี", "กระต่าย", "ลุงแมว", "นักตกปลา", "เหมียว", "มะลิ", "ใบชา", "สายลม"][seat],
      connected: true, dealer: seat === 0, bet: seat === 0 ? 0 : 10, cardCount: 2, acted: false,
      repeatBet: seat === 0 ? 0 : 10, leaving: false, betIssue: null }));
    const table = { roomId: "PIXEL-01", roundId: "round-1", phase: "action", serverTime: Date.now(),
      deadline: Date.now() + 15000, dealerSeat: 0, minBet: 10, maxMultiplier: 5, autoPlay: true,
      roundNumber: 1, seats, results: [] };
    const hand = { roundId: "round-1", cards: [{ rank: 5, suit: "hearts" }, { rank: 13, suit: "spades" }],
      canDraw: true, canStay: true, deadline: table.deadline };
    const render = () => { ui.table = table; ui.hand = hand; ui.render(); };
    window.tableQa = { ui, table, hand, sent, render };
    render();
  });
  await page.waitForTimeout(950);
  assert.equal(await page.locator(".pok-seat").count(), 8);
  assert.equal(await page.locator('.pok-seat.mine').getAttribute("data-position"), "0");
  assert.equal(await page.locator('.pok-seat.dealer').getAttribute("data-table-seat"), "0");
  assert.equal(await page.locator(".pok-seat:not(.mine) .pok-card.back").count(), 14);
  assert.equal(await page.locator(".pok-seat:not(.mine) .pok-card[data-rank]").count(), 0);
  assert.equal(await page.locator("#pokHandCards .pok-card:not(.back)").count(), 2);
  assert.match(await page.locator("#pokTotalBet").innerText(), /70/);
  const initial = await page.locator("#pokHandCards").innerHTML();
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.tableQa.render(); });
  assert.equal(await page.locator("#pokHandCards").innerHTML(), initial, "wallet/state rerenders must preserve hand nodes and not replay animation");
  await page.getByRole("button", { name: "จั่วไพ่", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.tableQa.sent.at(-1)), { type: "game:draw", body: { roundId: "round-1" } });
  await page.evaluate(() => {
    const q = window.tableQa;
    q.hand.cards.push({ rank: 4, suit: "diamonds" });
    q.hand.canDraw = q.hand.canStay = false;
    q.table.seats[3].cardCount = 3;
    q.table.seats[3].acted = true;
    q.render();
  });
  assert.equal(await page.locator('#pokHandCards .pok-card-slot[data-motion="draw"]').count(), 1);
  assert.equal(await page.locator('#pokHandCards .pok-card-slot').last().getAttribute("data-motion-count"), "1");
  assert.equal(await page.getByRole("button", { name: "จั่วไพ่", exact: true }).isDisabled(), true);
  await page.waitForTimeout(800);
  for (const width of [1280, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".pok-arena").scrollIntoViewIfNeeded();
    const seats = await page.locator(".pok-seat").evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }));
    await page.locator("#casino").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: "/tmp/ro-lounge-pok-table-" + width + ".png", fullPage: true });
    assert.ok(seats.every(seat => seat.x >= 0 && seat.right <= width), "all eight seats fit at " + width);
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i], b = seats[j];
      const intersection = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      assert.equal(intersection, 0, "seat " + i + " overlaps " + j + " at " + width);
    }
    await page.locator("#pokHandCards").scrollIntoViewIfNeeded();
    const cards = await page.locator("#pokHandCards .pok-card").evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(); return { left: r.left, right: r.right };
    }));
    assert.ok(cards.every(card => card.left >= 0 && card.right <= width), "three-card fan fits at " + width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator("#casino").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: "/tmp/ro-lounge-pok-table-" + width + ".png", fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    const q = window.tableQa;
    q.table.phase = "showdown";
    q.table.results = q.table.seats.slice(1).map(seat => ({ playerId: seat.playerId, outcome: "win", delta: 10, multiplier: 1 }));
    q.table.seats.forEach(seat => {
      seat.cardCount = 3;
      seat.cards = seat.seat === 3 ? q.hand.cards : [{ rank: 2, suit: "clubs" }, { rank: 4, suit: "diamonds" }, { rank: 10, suit: "hearts" }];
      seat.value = { kind: "points", points: 6, multiplier: 1, strength: 6 };
    });
    q.render();
  });
  assert.equal(await page.locator(".pok-seat .back").count(), 0);
  assert.equal(await page.locator('.pok-seat:not(.mine) .pok-card[data-motion="reveal"]').count(), 21);
  assert.equal(await page.locator('.pok-seat[data-outcome="win"]').count(), 7);
  assert.match(await page.locator("#pokHandValue").innerText(), /\+10 ชิป/);
  const revealed = await page.locator("#pokSeats").innerHTML();
  await page.evaluate(() => window.tableQa.render());
  assert.equal(await page.locator("#pokSeats").innerHTML(), revealed);
  await page.waitForTimeout(950);
  await page.screenshot({ path: "/tmp/ro-lounge-pok-table-showdown.png", fullPage: true });
  for (const width of [1280, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const seats = await page.locator(".pok-seat").evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }));
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i], b = seats[j];
      const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      if (overlap) {
        await page.locator("#casino").evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: "/tmp/ro-lounge-table-layout-failure.png" });
        console.log("layout diagnostics:", width, await page.locator(".pok-seat").nth(i).evaluate(el => [...el.children].map(child => ({ class: child.className, text: child.textContent, height: child.getBoundingClientRect().height }))));
      }
      assert.equal(overlap, 0, "showdown seat " + i + " overlaps " + j + " at " + width);
    }
  }
  // Changing tables/rounds clears private faces, and reduced motion prevents all deal/flip effects.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const q = window.tableQa;
    q.table.roundId = "round-2";
    q.table.phase = "dealing";
    q.table.results = [];
    q.table.seats.forEach(seat => { delete seat.cards; delete seat.value; seat.cardCount = 2; });
    q.render(); // private hand is deliberately stale (round-1), so it MUST NOT be displayed.
  });
  assert.equal(await page.locator("#pokHandCards .pok-card.back").count(), 2);
  assert.equal(await page.locator("#casino [data-motion]").count(), 0);
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: rotated eight-seat table, private hands, stable animation nodes, third-card draw, public reveal, payouts, 1280/1024/768/390/360/320px and reduced motion");
} finally { await browser.close(); }
