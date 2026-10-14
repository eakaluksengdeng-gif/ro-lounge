import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioQaContexts = [];
    const Original = window.AudioContext;
    window.AudioContext = new Proxy(Original, { construct(Target, args) {
      const context = new Target(...args); window.audioQaContexts.push(context); return context;
    } });
  });
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".game-sound-toggle").waitFor();
  assert.equal(await page.evaluate(() => window.audioQaContexts.length), 0, "no autoplay/context before a user gesture");
  await page.evaluate(async () => { window.soundQa = (await import("/src/audio/GameSounds.ts")).gameSounds; });
  assert.equal(await page.evaluate(() => window.soundQa.play("pok9")), false);
  await page.locator(".creator-turn button").first().click();
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "running");
  assert.equal(await page.evaluate(() => window.audioQaContexts.length), 1);
  const peak = await page.evaluate(async () => {
    const sound = window.soundQa, context = window.audioQaContexts[0];
    const analyser = context.createAnalyser(), silence = context.createGain();
    analyser.fftSize = 1024; silence.gain.value = 0;
    sound.master.connect(analyser); analyser.connect(silence).connect(context.destination);
    window.audioQaAnalyser = analyser;
    sound.play("pok9");
    const samples = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise(resolve => setTimeout(resolve, 20)); analyser.getFloatTimeDomainData(samples);
      for (const value of samples) peak = Math.max(peak, Math.abs(value));
    }
    return peak;
  });
  assert.ok(peak > .002 && peak < .3, "actual audible Pok wave at comfortable levels, peak=" + peak);
  const recipes = await page.evaluate(() => {
    const q = window.soundQa; q.setWorld("town");
    return ["ui", "select", "move", "footstep", "chat", "emote", "join", "enter", "exit", "bet", "cancel",
      "deal", "draw", "stay", "reveal", "pok8", "pok9", "win", "lose", "tie", "tick", "cast", "bite", "reel", "catch", "miss", "cat", "bee", "hop", "bird", "error"]
      .map(cue => [cue, q.play(cue)]);
  });
  assert.ok(recipes.every(([, played]) => played), "every named effect schedules actual Web Audio nodes");
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().voices), 0, "short effects release all oscillator/buffer nodes");
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().ambience), true);
  const rain = await page.evaluate(() => {
    const q = window.soundQa;
    q.setWeather("rain"); const source = q.ambience.source;
    for (let i = 0; i < 20; i++) q.setWeather("rain");
    return q.ambience.source === source;
  });
  assert.equal(rain, true, "weather rerenders do not start stacked rain loops");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "suspended");
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().ambience), false);
  assert.equal(await page.evaluate(() => window.soundQa.play("pok9")), false);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "running" && window.soundQa.diagnostics().ambience);
  await page.evaluate(() => window.soundQa.setWorld("boardgame"));
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().ambience), false);
  assert.equal(await page.evaluate(() => window.soundQa.play("footstep")), false, "no outdoor footsteps through the casino overlay");
  await page.evaluate(() => {
    const toggle = window.soundQa.createToggle(); toggle.id = "extraSoundToggle"; document.querySelector(".creator-sound-tools").append(toggle);
  });
  await page.getByRole("button", { name: "ปิดเสียงเกม", exact: true }).first().click();
  assert.equal(await page.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).count(), 2, "all controls stay in sync");
  assert.equal(await page.evaluate(() => localStorage.getItem("ro-sound-muted")), "true");
  assert.equal(await page.evaluate(() => window.soundQa.play("win")), false);
  await page.waitForTimeout(120);
  const silent = await page.evaluate(() => {
    const values = new Float32Array(window.audioQaAnalyser.fftSize); window.audioQaAnalyser.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs));
  });
  assert.ok(silent < .0001, "mute stops actual output, not just the icon");
  await page.reload();
  await page.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).waitFor();
  await page.locator(".creator-turn button").first().click();
  assert.equal(await page.evaluate(() => window.audioQaContexts.length), 0, "saved mute suppresses startup on reload");
  await page.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).click();
  await page.evaluate(async () => { window.soundQa = (await import("/src/audio/GameSounds.ts")).gameSounds; });
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "running");

  const stateCues = await page.evaluate(async () => {
    const { CasinoSounds } = await import("/src/audio/CasinoSounds.ts");
    const heard = [], sound = new CasinoSounds((cue, delay) => heard.push({ cue, delay }));
    const seat = (index, playerId) => ({ seat: index, playerId, name: playerId, connected: true, dealer: index === 0,
      bet: 0, repeatBet: 0, leaving: false, betIssue: null, cardCount: 0, acted: false });
    const table = { roomId: "sound-qa", roundId: null, phase: "betting", serverTime: Date.now(), deadline: null,
      dealerSeat: 0, minBet: 10, maxMultiplier: 5, autoPlay: false, roundNumber: 1, seats: [seat(0, "dealer"), seat(1, "me"), ...Array(6).fill(null)], results: [] };
    sound.update(table, "me");
    table.seats[1].bet = 10; sound.update(table, "me");
    table.phase = "dealing"; table.roundId = "r1"; table.seats.forEach(seat => { if (seat) seat.cardCount = 2; });
    sound.update(table, "me");
    for (let i = 0; i < 10; i++) sound.update(table, "me");
    table.phase = "check_pok"; sound.update(table, "me"); // Hidden ranks are not known: no Pok cue.
    const hiddenPok = heard.filter(item => item.cue.startsWith("pok")).length;
    table.seats[1].value = { kind: "pok8", points: 8, multiplier: 1, strength: 108 };
    sound.update(table, "me"); sound.update(table, "me"); // One public Pok announcement.
    table.phase = "action"; table.seats[0].cardCount = 3; sound.update(table, "me");
    const hand = { roundId: "r1", cards: [], canDraw: true, canStay: true, deadline: null };
    for (const seconds of [3, 3, 2, 3, 2, 1, 1, 0]) sound.tick(table, hand, seconds);
    table.phase = "showdown"; table.results = [{ playerId: "me", delta: 10, outcome: "win", multiplier: 1 }];
    sound.update(table, "me"); for (let i = 0; i < 10; i++) sound.update(table, "me");
    const live = [...heard]; heard.length = 0;
    sound.reset(); sound.update(table, "me"); sound.update(table, "me");
    return { live, hiddenPok, resumed: heard };
  });
  const cues = stateCues.live.map(item => item.cue);
  assert.equal(stateCues.hiddenPok, 0, "no private-hand Pok leak through sound");
  assert.equal(cues.filter(cue => cue === "deal").length, 4);
  assert.equal(cues.filter(cue => cue === "pok8").length, 1);
  assert.equal(cues.filter(cue => cue === "draw").length, 1);
  assert.equal(cues.filter(cue => cue === "tick").length, 3);
  assert.equal(cues.filter(cue => cue === "win").length, 1);
  assert.equal(cues.filter(cue => cue === "reveal").length, 1);
  assert.deepEqual(stateCues.resumed, [], "reconnecting/syncing into an existing result does not replay payouts or deals");

  const blocked = await browser.newPage(); blocked.on("pageerror", error => errors.push(error.message));
  await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error("blocked"); }; Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await blocked.goto("http://127.0.0.1:5173");
  await blocked.getByRole("button", { name: "ปิดเสียงเกม", exact: true }).click();
  await blocked.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).waitFor();
  const unsupported = await browser.newPage(); unsupported.on("pageerror", error => errors.push(error.message));
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await unsupported.goto("http://127.0.0.1:5173");
  await unsupported.locator(".game-sound-toggle").waitFor();
  assert.equal(await unsupported.locator(".game-sound-toggle").isDisabled(), true);
  await unsupported.locator(".creator-turn button").first().click();
  assert.deepEqual(errors, []);
  console.log("PASS: no autoplay, actual Pok audio samples, 31 effects, node cleanup, ambience dedup, mute/persistence/shared controls, public-only state cues/no replay, 3 countdown ticks, blocked storage and unsupported audio");
} finally { await browser.close(); }
