import type { WeatherKind } from "../../../shared/nature";
import "./sound.css";

export type SoundCue = "ui" | "select" | "move" | "footstep" | "chat" | "emote" | "join" | "enter" | "exit"
  | "bet" | "cancel" | "deal" | "draw" | "stay" | "reveal" | "pok8" | "pok9" | "win" | "lose" | "tie" | "tick"
  | "cast" | "bite" | "reel" | "catch" | "miss" | "cat" | "bee" | "hop" | "bird" | "error";
type World = "login" | "town" | "boardgame" | "disconnected";
type ContextWindow = Window & { webkitAudioContext?: typeof AudioContext };
const MUTED_KEY = "ro-sound-muted";
const COOLDOWN: Partial<Record<SoundCue, number>> = { ui: 60, select: 70, footstep: 180, chat: 160, emote: 250,
  cat: 12000, bee: 5000, hop: 1100, tick: 700, error: 800 };
const OUTDOOR: SoundCue[] = ["footstep", "move", "cat", "bee", "hop", "bird"];

/** Original Web Audio effects; no downloaded samples, card-rank-dependent pitches or game decisions. */
export class GameSounds {
  private context?: AudioContext;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private voices = new Set<AudioScheduledSourceNode>();
  private ambience?: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };
  private birdTimer?: number;
  private last = new Map<SoundCue, number>();
  private buttons = new Set<HTMLButtonElement>();
  private muted = false;
  private world: World = "login";
  private weather: WeatherKind = "sunny";
  private nearWater = false;
  private ambienceKey = "";
  private bound = false;
  private destroyed = false;
  private controller = new AbortController();

  constructor() {
    try { this.muted = localStorage.getItem(MUTED_KEY) === "true"; } catch { /* Private mode/blocked storage. */ }
  }

  get supported() { return !!(window.AudioContext ?? (window as ContextWindow).webkitAudioContext); }
  get isMuted() { return this.muted; }
  diagnostics() { return { muted: this.muted, context: this.context?.state ?? "locked", world: this.world,
    weather: this.weather, voices: this.voices.size, ambience: !!this.ambience }; }

  bindGestures() {
    if (this.bound) return;
    this.bound = true;
    const options = { capture: true, signal: this.controller.signal };
    const unlock = (event: Event) => { if (event.isTrusted) void this.unlock(); };
    document.addEventListener("pointerdown", unlock, options);
    document.addEventListener("keydown", unlock, options);
    document.addEventListener("click", event => {
      if (!event.isTrusted) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (button && !button.disabled && !button.classList.contains("game-sound-toggle")) this.play("ui");
    }, options);
    document.addEventListener("change", event => {
      const target = event.target;
      if (event.isTrusted && (target instanceof HTMLSelectElement || target instanceof HTMLInputElement && target.type === "radio")) this.play("select");
    }, options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopAll();
        void this.context?.suspend().catch(() => {});
      } else if (this.context && !this.muted) void this.unlock();
    }, { signal: this.controller.signal });
  }

  createToggle(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-sound-toggle";
    button.addEventListener("click", () => {
      this.setMuted(!this.muted);
      if (!this.muted) void this.unlock().then(() => this.play("select"));
    });
    this.buttons.add(button);
    this.updateButtons();
    return button;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try { localStorage.setItem(MUTED_KEY, String(muted)); } catch { /* Settings still work without storage. */ }
    if (muted) {
      this.stopAll();
      if (this.master && this.context) this.master.gain.setValueAtTime(0, this.context.currentTime);
    } else if (this.context) void this.unlock();
    this.updateButtons();
  }

  async unlock(): Promise<void> {
    if (this.destroyed || this.muted || document.hidden || !this.supported) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? (window as ContextWindow).webkitAudioContext!;
        this.context = new Context({ latencyHint: "interactive" });
        this.master = this.context.createGain();
        this.master.gain.value = .55;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.ratio.value = 5;
        this.master.connect(limiter).connect(this.context.destination);
      }
      if (this.context.state !== "running" && this.context.state !== "closed") await this.context.resume();
      if (!this.muted && !document.hidden && !this.destroyed) {
        this.master!.gain.setTargetAtTime(.55, this.context.currentTime, .01);
        this.refreshAmbience();
      }
    } catch { /* Audio is optional; autoplay/unsupported devices never block joining or actions. */ }
  }

  setWorld(world: World) {
    if (world === this.world) return;
    this.world = world;
    this.stopAll();
    this.refreshAmbience();
  }
  setWeather(weather: WeatherKind) {
    if (weather === this.weather) return;
    this.weather = weather;
    this.stopAmbience();
    this.refreshAmbience();
  }
  setNearWater(near: boolean) {
    if (near === this.nearWater) return;
    this.nearWater = near;
    this.stopAmbience();
    this.refreshAmbience();
  }

  play(cue: SoundCue, delay = 0): boolean {
    const ctx = this.context;
    if (this.destroyed || this.muted || document.hidden || !ctx || ctx.state !== "running" || !this.master) return false;
    if (OUTDOOR.includes(cue) && this.world !== "town") return false;
    const now = performance.now();
    if (now - (this.last.get(cue) ?? -Infinity) < (COOLDOWN[cue] ?? 0)) return false;
    this.last.set(cue, now);
    const at = ctx.currentTime + .008 + Math.max(0, Math.min(delay, 2));
    const tone = (hz: number, duration = .09, volume = .07, offset = 0, endHz = hz, type: OscillatorType = "sine") =>
      this.tone(at + offset, hz, endHz, duration, volume, type);
    const tap = (duration = .06, volume = .06, hz = 1700, offset = 0) => this.noise(at + offset, duration, volume, hz);
    const melody = (notes: number[], pace = .09, volume = .06) => notes.forEach((hz, i) => tone(hz, pace * 1.4, volume, i * pace, hz, "triangle"));
    switch (cue) {
      case "ui": tone(560, .04, .025, 0, 710); break;
      case "select": melody([520, 780], .055, .035); break;
      case "move": tone(780, .055, .025, 0, 540); break;
      case "footstep": tap(.045, .028, 450); tone(130, .04, .025, 0, 90); break;
      case "chat": melody([660, 880], .06, .035); break;
      case "emote": melody([440, 660, 550], .055, .045); break;
      case "join": melody([392, 494, 587, 784], .09); break;
      case "enter": tap(.1, .035, 600); melody([330, 440, 660], .075); break;
      case "exit": melody([660, 440, 330], .06, .04); break;
      case "bet": tap(.04, .055, 2700); melody([1400, 1800], .04, .04); break;
      case "cancel": tone(440, .1, .035, 0, 270); break;
      case "deal": tap(.065, .065, 2200); tone(230, .045, .02, .015, 140); break;
      case "draw": tap(.11, .065, 1900); tone(280, .09, .035, .015, 470); break;
      case "stay": melody([420, 520], .07, .035); break;
      case "reveal": tap(.12, .05, 2900); melody([600, 820], .065, .045); break;
      case "pok8": tap(.035, .09, 800); melody([523, 659, 784], .075, .09); break;
      case "pok9": tap(.035, .09, 800); melody([659, 784, 1047, 1319], .075, .09); break;
      case "win": melody([523, 659, 784, 1047], .105, .075); tap(.04, .025, 3200, .32); break;
      case "lose": melody([392, 330, 262], .115, .055); break;
      case "tie": melody([523, 523], .13, .04); break;
      case "tick": tone(880, .055, .035); break;
      case "cast": tap(.2, .055, 1500); tone(360, .16, .035, 0, 120); break;
      case "bite": melody([880, 1175, 880], .08, .07); tap(.1, .03, 900); break;
      case "reel": tap(.12, .05, 2100); tone(240, .11, .035, 0, 510); break;
      case "catch": tap(.2, .07, 700); melody([523, 784, 1047], .1, .065); break;
      case "miss": tone(300, .23, .045, 0, 110); tap(.08, .025, 600, .15); break;
      case "cat": tone(520, .16, .04, 0, 790); tone(790, .23, .03, .14, 400); break;
      case "bee": tone(150, .22, .014, 0, 180, "sawtooth"); break;
      case "hop": tap(.025, .025, 400); break;
      case "bird": tone(1800, .07, .025, 0, 2400); tone(2100, .065, .02, .1, 1600); break;
      case "error": melody([260, 220], .08, .045); break;
    }
    return true;
  }

  private tone(at: number, hz: number, endHz: number, duration: number, volume: number, type: OscillatorType) {
    const ctx = this.context!;
    const source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = type; source.frequency.setValueAtTime(hz, at); source.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(gain).connect(this.master!);
    this.track(source, [gain]); source.start(at); source.stop(at + duration + .015);
  }
  private buffer() {
    if (!this.noiseBuffer) {
      const ctx = this.context!;
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }
  private noise(at: number, duration: number, volume: number, hz: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    source.buffer = this.buffer(); filter.type = "lowpass"; filter.frequency.value = hz;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .005);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.master!);
    this.track(source, [filter, gain]); source.start(at, Math.random()); source.stop(at + duration + .02);
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
  }
  private refreshAmbience() {
    if (this.destroyed || this.muted || document.hidden || this.world !== "town" || this.context?.state !== "running") return;
    const key = this.weather + ":" + this.nearWater;
    if (key === this.ambienceKey) return;
    this.stopAmbience(); this.ambienceKey = key;
    const ctx = this.context;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.buffer(); source.loop = true;
    filter.type = "lowpass"; filter.frequency.value = this.weather === "rain" ? 1600 : this.nearWater ? 750 : 320;
    gain.gain.value = this.weather === "rain" ? .05 : this.weather === "snow" ? .024 : this.nearWater ? .027 : .009;
    source.connect(filter).connect(gain).connect(this.master!); source.start();
    this.ambience = { source, filter, gain };
    const birds = () => {
      if (this.world === "town" && this.weather === "sunny" && !this.muted && !document.hidden) this.play("bird");
      this.birdTimer = window.setTimeout(birds, 8000 + Math.random() * 7000);
    };
    this.birdTimer = window.setTimeout(birds, 5000);
  }
  private stopAmbience() {
    if (this.birdTimer !== undefined) window.clearTimeout(this.birdTimer);
    this.birdTimer = undefined; this.ambienceKey = "";
    if (this.ambience) {
      try { this.ambience.source.stop(); } catch { /* Already stopped. */ }
      this.ambience.source.disconnect(); this.ambience.filter.disconnect(); this.ambience.gain.disconnect();
      this.ambience = undefined;
    }
  }
  private stopAll() {
    this.stopAmbience();
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
  }
  private updateButtons() {
    for (const button of this.buttons) {
      const enabled = this.supported && !this.muted;
      button.textContent = enabled ? "🔊" : "🔇";
      button.setAttribute("aria-label", this.supported ? (this.muted ? "เปิดเสียงเกม" : "ปิดเสียงเกม") : "อุปกรณ์นี้ไม่รองรับเสียงเกม");
      button.setAttribute("aria-pressed", String(enabled));
      button.title = this.supported ? (this.muted ? "เสียงปิด · กดเพื่อเปิด" : "เสียงเปิด · กดเพื่อปิด") : "อุปกรณ์นี้ไม่รองรับเสียงเกม";
      button.disabled = !this.supported;
    }
  }
  destroy() {
    this.destroyed = true; this.controller.abort(); this.stopAll();
    void this.context?.close().catch(() => {}); this.buttons.clear();
  }
}

// A single mixer per browser page, including source-module/HMR imports with different cache URLs.
// This contains audio settings/nodes only, never guest credentials or private game state.
const SOUND_KEY = Symbol.for("ro-lounge.game-sounds");
const soundHost = globalThis as typeof globalThis & { [key: symbol]: GameSounds | undefined };
export const gameSounds = soundHost[SOUND_KEY] ?? (soundHost[SOUND_KEY] = new GameSounds());
