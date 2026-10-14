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
  assert.equal(result.largeBalance, "123,456,789");
  await page.screenshot({ path: "/tmp/ro-lounge-pixel-deck.png", fullPage: true });
  const numeric = await page.evaluate(async () => {
    const { coinAmount } = await import("/src/pokdeng/PixelCards.ts");
    const { formatNumber, formatDelta } = await import("/src/pokdeng/numbers.ts");
    return { amounts: [0, 1, 2, 3, 8, 10, 123, 1234, 123456789, Number.MAX_SAFE_INTEGER].map(amount => {
      const badge = coinAmount(amount, "suffix");
      return { raw: badge.dataset.balance, displayed: badge.querySelector(".gold-amount").textContent, title: badge.title };
    }), plus: formatDelta(1234), minus: formatDelta(-1234), zero: formatDelta(0), negativeZero: formatDelta(-0), ordinary: formatNumber(123),
      moneyFont: getComputedStyle(document.querySelector(".gold-amount")).fontFamily,
      cardFont: getComputedStyle(document.querySelector(".pok-rank")).fontFamily };
  });
  for (const amount of numeric.amounts) {
    assert.equal(amount.displayed, Number(amount.raw).toLocaleString("en-US"));
    assert.equal(amount.title, amount.displayed + " ชิป");
    assert.match(amount.displayed, /^[0-9,]+$/);
  }
  assert.deepEqual([numeric.plus, numeric.minus, numeric.zero, numeric.ordinary], ["+1,234", "-1,234", "0", "123"]);
  assert.equal(numeric.negativeZero, "0");
  assert.ok(numeric.moneyFont.includes("Arial") && !numeric.moneyFont.includes("Pixelify"));
  assert.ok(numeric.cardFont.includes("Arial") && !numeric.cardFont.includes("Pixelify"));
  await page.evaluate(async () => {
    const { playingCard, coinAmount } = await import("/src/pokdeng/PixelCards.ts");
    document.body.replaceChildren();
    document.body.style.cssText = "height:100%;padding:0";
    const toolbar = document.createElement("div"); toolbar.id = "casinoToolbar";
    const balance = document.createElement("span");
    const meta = document.createElement("span"); meta.className = "wallet-hud-details"; meta.textContent = " · ใช้ได้ 113 · สำรอง 0";
    balance.append(coinAmount(113, "prefix"), meta);
    const { gameSounds } = await import("/src/audio/GameSounds.ts");
    const travel = document.createElement("button"); travel.textContent = "♠ ไป Boardgame";
    toolbar.append(balance, travel, gameSounds.createToggle());
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
      if (hud.y + hud.height > nature.y) {
        console.log("HUD layout:", width, hud, nature, await page.locator("#casinoToolbar").evaluate(el => [...el.querySelectorAll("span, strong, button")].map(child => ({ class: child.className, text: child.textContent, width: child.getBoundingClientRect().width, height: child.getBoundingClientRect().height, font: getComputedStyle(child).font }))));
        await page.screenshot({ path: "/tmp/ro-lounge-numbers-layout-failure.png" });
      }
      assert.ok(hud.y + hud.height <= nature.y, "coin HUD must not overlap weather/fishing controls");
    }
    await page.screenshot({ path: "/tmp/ro-lounge-pixel-hand-" + width + ".png" });
    for (const amount of [123, 1234, 123456789, Number.MAX_SAFE_INTEGER]) {
      await page.evaluate(async value => {
        const { coinAmount } = await import("/src/pokdeng/PixelCards.ts");
        const { formatNumber } = await import("/src/pokdeng/numbers.ts");
        document.querySelector("#casinoToolbar .gold-balance").replaceWith(coinAmount(value, "prefix"));
        document.querySelector(".wallet-hud-details").textContent = " · ใช้ได้ " + formatNumber(value) + " · สำรอง 0";
        document.querySelector("#pokWallet .gold-balance").replaceWith(coinAmount(value, "suffix"));
      }, amount);
      const money = await page.locator("#pokWallet .gold-balance, #casinoToolbar .gold-balance").evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect(); const unit = el.querySelector(".gold-unit");
        return { left: r.left, right: r.right, unitVisible: getComputedStyle(unit).position === "static" };
      }));
      assert.ok(money.every(balance => balance.left >= 0 && balance.right <= width && balance.unitVisible), "exact amount and visible chip unit must fit " + width + "px, amount " + amount);
      const hud = await page.locator("#casinoToolbar").boundingBox();
      const travel = await page.getByRole("button", { name: "♠ ไป Boardgame", exact: true }).boundingBox();
      const coin = await page.locator("#casinoToolbar .gold-balance").boundingBox();
      assert.ok(coin.x + coin.width <= travel.x, "wallet must not overlap travel button");
      if (width <= 680) {
        const nature = await page.locator("#natureBar").boundingBox();
        assert.ok(hud.y + hud.height <= nature.y, "large wallet must not overlap weather controls");
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { coinAmount } = await import("/src/pokdeng/PixelCards.ts");
    document.querySelector("#casinoToolbar .gold-balance").replaceWith(coinAmount(123, "prefix"));
    document.querySelector(".wallet-hud-details").textContent = " · ใช้ได้ 123 · สำรอง 0";
    document.querySelector("#pokWallet .gold-balance").replaceWith(coinAmount(1234, "suffix"));
  });
  await page.screenshot({ path: "/tmp/ro-lounge-readable-numbers.png" });
  await page.locator("#casino").evaluate(el => { el.hidden = true; });
  await page.locator("#casinoToolbar").screenshot({ path: "/tmp/ro-lounge-chip-hud-preview.png" });
  console.log("PASS: 52 faces; clear Arabic digits, grouping/signed deltas without changing raw values, visible chip units; wallets and three cards fit 1280/390/360/320px");
} finally { await browser.close(); }
