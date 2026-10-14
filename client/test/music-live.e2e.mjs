import { chromium } from "playwright";
import assert from "node:assert/strict";

// Uses an isolated guest and watches the table only: never seats, bets or starts a round.
const url = process.env.RO_TEST_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.musicQaContexts = [];
    const Original = window.AudioContext;
    window.AudioContext = new Proxy(Original, { construct(Target, args) {
      const context = new Target(...args); window.musicQaContexts.push(context); return context;
    } });
  });
  await page.goto(url);
  await page.locator(".game-music-control").waitFor();
  assert.equal(await page.evaluate(() => window.musicQaContexts.length), 0);
  await page.locator("#nameInput").fill("Cozy QA");
  await page.getByRole("button", { name: /เข้าเมือง/ }).click();
  await page.locator("#game canvas").waitFor({ timeout: 90000 });
  await page.waitForFunction(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().music.running);
  assert.equal(await page.evaluate(() => window.musicQaContexts.length), 1, "one mixer after actual multiplayer join");
  await page.waitForTimeout(1800); // Let the welcome effect end before measuring the music bus.
  const peak = await page.evaluate(async () => {
    const sound = globalThis[Symbol.for("ro-lounge.game-sounds")], ctx = window.musicQaContexts[0];
    const analyser = ctx.createAnalyser(), silence = ctx.createGain(); silence.gain.value = 0;
    sound.music.gain.connect(analyser); analyser.connect(silence).connect(ctx.destination);
    const samples = new Float32Array(analyser.fftSize); let peak = 0;
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 20)); analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    }
    sound.music.gain.disconnect(analyser); analyser.disconnect(); silence.disconnect(); return peak;
  });
  assert.ok(peak > .0005 && peak < .04, "live browser music is audible and quiet: " + peak);
  await page.locator("#emotes .game-music-control").click();
  await page.locator("#gameMusicVolume").fill("10");
  await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).uncheck();
  const off = await page.evaluate(() => {
    const sound = globalThis[Symbol.for("ro-lounge.game-sounds")];
    return { state: sound.diagnostics(), effect: sound.play("deal"), saved: localStorage.getItem("ro-music-volume") };
  });
  assert.equal(off.state.music.running, false); assert.equal(off.state.music.voices, 0);
  assert.equal(off.effect, true); assert.equal(off.saved, "0.1");
  await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "♠ ไป Boardgame", exact: true }).click();
  await page.locator("#casino").waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.evaluate(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().world), "boardgame");
  assert.equal(await page.evaluate(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().music.running), true);
  assert.equal(await page.evaluate(() => window.musicQaContexts.length), 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator("#casino .game-music-control").click();
    const box = await page.locator("#gameMusicSettings").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "/tmp/ro-lounge-cozy-live-" + width + ".png" });
    await page.keyboard.press("Escape");
    const buttons = await page.locator("#casino .pok-header-actions button").evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(); return { left: r.left, right: r.right };
    }));
    assert.ok(buttons.every(button => button.left >= 0 && button.right <= width));
  }
  await page.locator("#casino").getByRole("button", { name: "ปิดเสียงเกม", exact: true }).click();
  assert.equal(await page.evaluate(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().music.running), false);
  await page.locator("#casino").getByRole("button", { name: "เปิดเสียงเกม", exact: true }).click();
  await page.waitForFunction(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().music.running);
  await page.getByRole("button", { name: "ออกสู่เมือง", exact: true }).click();
  await page.locator("#casino").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => globalThis[Symbol.for("ro-lounge.game-sounds")].diagnostics().world), "town");
  assert.deepEqual(errors, []);
  console.log("PASS: " + url + " actual multiplayer town/table music, quiet waveform=" + peak.toFixed(5)
    + ", no autoplay/single mixer, music-only mute leaves effects, persisted volume, global mute, mobile 390/320, spectator exit");
} finally { await browser.close(); }
