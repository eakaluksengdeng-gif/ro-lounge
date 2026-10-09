import { chromium } from "playwright";
import assert from "node:assert/strict";

// Local Vite harness: deterministic visual QA of all 52 faces, without changing game state or adding a production route.
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto("http://127.0.0.1:5173");
  const result = await page.evaluate(async () => {
    const { playingCard, coinAmount } = await import("/src/pokdeng/PixelCards.ts");
    document.body.replaceChildren();
    document.body.style.cssText = "height:auto;padding:24px;background:#163b32";
    const wallet = document.createElement("div");
    wallet.id = "pokWallet";
    wallet.append(coinAmount(113, "prefix"), coinAmount(123456789, "suffix"));
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(13,106px);gap:16px;margin-top:24px;width:max-content";
    const faces = [];
    for (const suit of ["clubs", "diamonds", "hearts", "spades"]) for (let rank = 1; rank <= 13; rank++) {
      const card = playingCard({ rank, suit }, true);
      faces.push({ rank, suit, label: card.getAttribute("aria-label"), pips: card.querySelectorAll(".pok-pip").length, portraits: card.querySelectorAll(".pixel-royal").length });
      grid.append(card);
    }
    const back = playingCard(undefined, true);
    grid.append(back);
    document.body.append(wallet, grid);
    return { faces, back: { label: back.getAttribute("aria-label"), rank: back.dataset.rank, suit: back.dataset.suit },
      coin: wallet.querySelector("svg").getAttribute("viewBox"), largeBalance: wallet.querySelectorAll(".gold-amount")[1].textContent };
  });
  assert.equal(result.faces.length, 52);
  assert.equal(new Set(result.faces.map(face => face.label)).size, 52);
  for (const face of result.faces) {
    assert.equal(face.pips, face.rank <= 10 ? face.rank : 0);
    assert.equal(face.portraits, face.rank > 10 ? 2 : 0);
  }
  assert.deepEqual(result.back, { label: "ไพ่คว่ำ", rank: undefined, suit: undefined });
  assert.equal(result.coin, "0 0 16 16");
  assert.equal(result.largeBalance, "123456789");
  await page.screenshot({ path: "/tmp/ro-lounge-pixel-deck.png", fullPage: true });
  await page.evaluate(async () => {
    const { playingCard, coinAmount } = await import("/src/pokdeng/PixelCards.ts");
    document.body.replaceChildren();
    document.body.style.cssText = "height:100%;padding:0";
    const toolbar = document.createElement("div"); toolbar.id = "casinoToolbar";
    const balance = document.createElement("span");
    const meta = document.createElement("span"); meta.className = "wallet-hud-details"; meta.textContent = " · ใช้ได้ 113 · สำรอง 0";
    balance.append(coinAmount(113, "prefix"), meta);
    const travel = document.createElement("button"); travel.textContent = "♠ ไปบ้านป๊อกเด้ง";
    toolbar.append(balance, travel);
    const nature = document.createElement("div"); nature.id = "natureBar"; nature.textContent = "☀ แดดออก · 🐟 ปลา 0";
    document.body.append(toolbar, nature);
    const modal = document.createElement("section"); modal.id = "casino";
    const panel = document.createElement("div"); panel.className = "pok-panel";
    const wallet = document.createElement("div"); wallet.id = "pokWallet"; wallet.append(coinAmount(113, "suffix"));
    const hand = document.createElement("section"); hand.id = "pokHand";
    const header = document.createElement("div"); header.className = "pok-hand-header";
    const title = document.createElement("h3"); title.textContent = "ไพ่ของคุณ"; header.append(title);
    const body = document.createElement("div"); body.className = "pok-hand-body";
    const cards = document.createElement("div"); cards.id = "pokHandCards";
    cards.append(playingCard({ rank: 7, suit: "hearts" }, true), playingCard({ rank: 9, suit: "clubs" }, true), playingCard({ rank: 13, suit: "diamonds" }, true));
    const decisions = document.createElement("div"); decisions.className = "pok-hand-decisions";
    const score = document.createElement("p"); score.id = "pokHandValue"; score.textContent = "6 แต้ม";
    const actions = document.createElement("div"); actions.className = "pok-hand-actions";
    for (const label of ["จั่วไพ่", "อยู่ / ผ่าน"]) { const button = document.createElement("button"); button.textContent = label; actions.append(button); }
    decisions.append(score, actions); body.append(cards, decisions); hand.append(header, body); panel.append(wallet, hand); modal.append(panel); document.body.append(modal);
  });
  for (const width of [1280, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const cards = await page.locator("#pokHandCards .pok-card").evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width };
    }));
    assert.ok(cards.every(card => card.left >= 0 && card.right <= width), "all three private cards must fit width " + width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width <= 680) {
      const hud = await page.locator("#casinoToolbar").boundingBox();
      const nature = await page.locator("#natureBar").boundingBox();
      assert.ok(hud.y + hud.height <= nature.y, "coin HUD must not overlap weather/fishing controls");
    }
    await page.screenshot({ path: "/tmp/ro-lounge-pixel-hand-" + width + ".png" });
  }
  console.log("PASS: all 52 pixel faces, exact pips, double-sided J/Q/K, private back, gold wallet; three cards and HUD fit 1280/390/360/320px");
} finally { await browser.close(); }
