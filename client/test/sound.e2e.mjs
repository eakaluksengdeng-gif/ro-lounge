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
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), false, "creator has no background music");
  await page.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).click();
  assert.equal(await page.locator("#gameMusicVolume").inputValue(), "20");
  await page.getByRole("button", { name: "ปิดการตั้งค่าเพลง", exact: true }).click();
  await page.waitForFunction(() => window.audioQaContexts[0].currentTime > .08);
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
  assert.ok(peak > .002 && peak < .3, "actual audible Pok wave at comfortable levels, peak=" + peak + " state=" + JSON.stringify(await page.evaluate(() => ({ sound: window.soundQa.diagnostics(), audio: window.audioQaContexts.map(c => ({ state: c.state, time: c.currentTime })), hidden: document.hidden }))));
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
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), true);
  const musicContinuity = await page.evaluate(async () => {
    const sound = window.soundQa, music = sound.music, timer = music.timer;
    for (let i = 0; i < 20; i++) { await sound.unlock(); sound.setWorld("town"); sound.setWeather("rain"); }
    sound.setWorld("boardgame");
    return sound.music === music && music.timer === timer;
  });
  assert.equal(musicContinuity, true, "gestures, weather and town-to-table transitions do not stack or restart music");
  const musicPeak = await page.evaluate(async () => {
    const analyser = window.audioQaAnalyser, samples = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 20)); analyser.getFloatTimeDomainData(samples);
      for (const value of samples) peak = Math.max(peak, Math.abs(value));
    }
    return peak;
  });
  assert.ok(musicPeak > .0005 && musicPeak < .02 && musicPeak < peak / 3, "real default music is audible but well below Pok effects: " + musicPeak);
  await page.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).click();
  await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).uncheck();
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), false);
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.voices), 0);
  assert.equal(await page.evaluate(() => window.soundQa.play("deal")), true, "music-only mute leaves card effects enabled");
  await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).check();
  await page.locator("#gameMusicVolume").fill("8");
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().musicVolume), .08);
  assert.equal(await page.evaluate(() => localStorage.getItem("ro-music-volume")), "0.08");
  await page.locator("#gameMusicVolume").fill("0");
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), false, "zero volume releases all music nodes/timer");
  await page.locator("#gameMusicVolume").fill("20");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#gameMusicSettings").isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).evaluate(button => button === document.activeElement), true);
  await page.evaluate(() => window.soundQa.setWorld("town"));
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
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), false);
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.voices), 0);
  assert.equal(await page.evaluate(() => window.soundQa.play("pok9")), false);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "running" && window.soundQa.diagnostics().ambience);
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), true, "foreground resumes one quiet music loop");
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
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().music.running), false, "global mute also stops music");
  await page.waitForTimeout(120);
  await page.waitForFunction(() => {
    const values = new Float32Array(window.audioQaAnalyser.fftSize); window.audioQaAnalyser.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs)) < .0001;
  }, null, { timeout: 2000 });
  const silent = await page.evaluate(() => {
    const values = new Float32Array(window.audioQaAnalyser.fftSize); window.audioQaAnalyser.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs));
  });
  assert.ok(silent < .0001, "mute stops actual output, not just the icon: peak=" + silent + " state=" + JSON.stringify(await page.evaluate(() => window.soundQa.diagnostics())));
  await page.reload();
  await page.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).waitFor();
  await page.locator(".creator-turn button").first().click();
  assert.equal(await page.evaluate(() => window.audioQaContexts.length), 0, "saved mute suppresses startup on reload");
  await page.getByRole("button", { name: "เปิดเสียงเกม", exact: true }).click();
  await page.evaluate(async () => { window.soundQa = (await import("/src/audio/GameSounds.ts")).gameSounds; });
  await page.waitForFunction(() => window.soundQa.diagnostics().context === "running");
  await page.evaluate(() => { window.soundQa.setWorld("town"); window.soundQa.setMusicVolume(.08); window.soundQa.setMusicMuted(true); });
  await page.reload();
  await page.evaluate(async () => { window.soundQa = (await import("/src/audio/GameSounds.ts")).gameSounds; });
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().musicVolume), .08);
  assert.equal(await page.evaluate(() => window.soundQa.diagnostics().musicMuted), true);
  await page.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).click();
  assert.equal(await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).isChecked(), false);
  await page.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).check();
  await page.evaluate(() => { window.soundQa.setWorld("town"); window.soundQa.setMusicVolume(.2); });
  const loop = await page.evaluate(async () => {
    const sound = window.soundQa, first = sound.diagnostics().music.step;
    let wrapped = false, last = first, maxVoices = 0;
    for (let i = 0; i < 140; i++) {
      await new Promise(resolve => setTimeout(resolve, 200)); const state = sound.diagnostics().music;
      if (state.step < last) wrapped = true;
      last = state.step; maxVoices = Math.max(maxVoices, state.voices);
    }
    sound.setWorld("disconnected");
    return { wrapped, maxVoices, stopped: sound.diagnostics().music };
  });
  assert.equal(loop.wrapped, true, "full original 8-bar phrase loops");
  assert.ok(loop.maxVoices > 0 && loop.maxVoices <= 12, "music nodes remain bounded over a full phrase");
  assert.equal(loop.stopped.running, false); assert.equal(loop.stopped.voices, 0);
  await page.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await page.locator("#gameMusicSettings").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width, "music panel fits narrow mobile width " + width);
    await page.screenshot({ path: "/tmp/ro-lounge-cozy-music-" + width + ".png" });
  }

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
  await blocked.getByRole("button", { name: "ปรับเพลง cozy", exact: true }).click();
  await blocked.locator("#gameMusicVolume").fill("8");
  await blocked.getByRole("checkbox", { name: "เล่นเพลง cozy", exact: true }).uncheck();
  const unsupported = await browser.newPage(); unsupported.on("pageerror", error => errors.push(error.message));
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await unsupported.goto("http://127.0.0.1:5173");
  await unsupported.locator(".game-sound-toggle").waitFor();
  assert.equal(await unsupported.locator(".game-sound-toggle").isDisabled(), true);
  assert.equal(await unsupported.locator(".game-music-control").isDisabled(), true);
  await unsupported.locator(".creator-turn button").first().click();
  assert.deepEqual(errors, []);
  console.log("Measured Web Audio peaks: Pok=" + peak.toFixed(5) + ", default cozy music=" + musicPeak.toFixed(5));
  console.log("PASS: quiet original cozy music waveform/full 8-bar loop/bounded nodes, single mixer, separate music volume/mute/persistence, continuity, mobile panel; no autoplay, actual Pok audio samples, 31 effects, cleanup, ambience dedup, global mute, visibility, public-only cues/no replay, blocked storage and unsupported audio");
} finally { await browser.close(); }
