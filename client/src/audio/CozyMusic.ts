// An original 8-bar, 76 BPM loop: warm keys, soft bass and a sparse melody.
// Uses the game's existing AudioContext; it never reads cards, wallets or network state.
const STEP = 60 / 76 / 2;
const CHORDS = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52],
  [48, 52, 55, 59], [40, 43, 47, 50], [41, 45, 50, 53], [43, 47, 50, 55]];
const MELODY = [[72, 0, 76, 0, 79, 76, 74, 0], [72, 0, 71, 0, 69, 0, 67, 0],
  [69, 0, 72, 0, 76, 0, 72, 0], [71, 0, 74, 0, 72, 71, 67, 0],
  [76, 0, 79, 0, 83, 79, 76, 0], [74, 0, 71, 0, 67, 0, 64, 0],
  [69, 0, 74, 0, 77, 74, 72, 0], [71, 0, 74, 0, 67, 0, 0, 0]];

export class CozyMusic {
  private gain: GainNode;
  private filter: BiquadFilterNode;
  private voices = new Set<OscillatorNode>();
  private timer?: number;
  private next = 0;
  private step = 0;
  private volume = 0;
  private biome = "town";
  setBiome(biome:string) {
    this.biome=biome;
    // Ease the timbre of the same quiet theme instead of starting another overlapping loop.
    this.filter.frequency.setTargetAtTime(biome==="forest"?1050:biome==="beach"?1150:biome==="farm"?1650:biome==="market"?1500:1400,this.context.currentTime,.5);
  }

  constructor(private context: AudioContext, destination: AudioNode) {
    this.gain = context.createGain(); this.gain.gain.value = 0;
    this.filter = context.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 1400;
    this.filter.connect(this.gain).connect(destination);
  }

  diagnostics() { return { running: this.timer !== undefined, voices: this.voices.size, step: this.step }; }
  setVolume(volume: number) {
    this.volume = volume * .16; // Default 20% stays well below action/Pok effects.
    this.gain.gain.setTargetAtTime(this.timer === undefined ? 0 : this.volume, this.context.currentTime, .12);
  }
  start() {
    if (this.timer !== undefined || this.context.state !== "running") return;
    this.next = this.context.currentTime + .05;
    this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, .25);
    this.timer = window.setInterval(() => this.schedule(), 100);
    this.schedule();
  }
  private schedule() {
    if (this.context.state !== "running") { this.stop(); return; }
    // Never catch up with a burst of notes after a busy frame/tab suspension.
    if (this.next < this.context.currentTime) this.next = this.context.currentTime + .04;
    while (this.next < this.context.currentTime + .22) {
      const bar = Math.floor(this.step / 8), beat = this.step % 8, chord = CHORDS[bar];
      if (beat === 0 || beat === 4) this.note(chord[0] - 12, this.next, STEP * 3.5, .25, "sine");
      if (beat % 2 === 0) this.note(chord[1 + (beat / 2) % 3], this.next, STEP * 2.4, .14, "triangle");
      const lead = MELODY[bar][beat];
      if (lead) this.note(lead, this.next + .018, STEP * 1.65, .22, "sine");
      this.next += STEP; this.step = (this.step + 1) % 64;
    }
  }
  private note(midi: number, at: number, duration: number, volume: number, type: OscillatorType) {
    midi += this.biome === "beach" ? -5 : this.biome === "market" ? 2 : this.biome === "farm" ? 5 : this.biome === "forest" ? -2 : 0;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + .035);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope).connect(this.filter);
    this.voices.add(oscillator);
    oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  stop() {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    this.gain.gain.cancelScheduledValues(this.context.currentTime);
    this.gain.gain.setValueAtTime(0, this.context.currentTime);
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
  }
  destroy() { this.stop(); this.filter.disconnect(); this.gain.disconnect(); }
}
