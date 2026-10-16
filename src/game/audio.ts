export type SfxName =
  | "bounce"
  | "rim"
  | "board"
  | "swish"
  | "score"
  | "buzzer"
  | "cheer"
  | "click"
  | "whoosh"
  | "miss";

/** Tiny procedural sound kit — no external assets, all synthesized with WebAudio. */
export class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;

  private ensure(): boolean {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AC: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      // cached white-noise buffer
      const len = Math.floor(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  resume() {
    this.ensure();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.master && this.ctx) this.master.gain.value = v ? 0.55 : 0;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    freqEnd?: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseBurst(
    dur: number,
    gain: number,
    filterType: BiquadFilterType,
    freq: number,
    q = 1,
    delay = 0,
    sweepTo?: number,
  ) {
    if (!this.ctx || !this.master || !this.noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  play(name: SfxName, intensity = 1) {
    if (!this.ensure()) return;
    const i = Math.max(0.05, Math.min(1, intensity));
    switch (name) {
      case "bounce":
        this.tone(150 + 60 * i, 0.13, "sine", 0.32 * i, 55);
        this.noiseBurst(0.05, 0.08 * i, "lowpass", 900);
        break;
      case "rim":
        this.tone(720, 0.16, "square", 0.1 * i, 690);
        this.tone(1080, 0.11, "triangle", 0.07 * i, 1020);
        this.noiseBurst(0.07, 0.1 * i, "highpass", 2600, 1);
        break;
      case "board":
        this.tone(190, 0.2, "sine", 0.28 * i, 70);
        this.noiseBurst(0.1, 0.14 * i, "bandpass", 700, 2);
        break;
      case "swish":
        this.noiseBurst(0.3, 0.3, "bandpass", 2600, 1.4, 0, 900);
        break;
      case "score":
        this.tone(659, 0.14, "triangle", 0.16);
        this.tone(880, 0.14, "triangle", 0.16, undefined, 0.09);
        this.tone(1175, 0.3, "triangle", 0.18, undefined, 0.18);
        break;
      case "cheer":
        this.noiseBurst(1.1, 0.2 * i, "bandpass", 1100, 0.6);
        this.noiseBurst(0.9, 0.12 * i, "bandpass", 2200, 0.5, 0.05);
        break;
      case "miss":
        this.tone(240, 0.16, "sawtooth", 0.07, 120);
        break;
      case "whoosh":
        this.noiseBurst(0.22, 0.13, "bandpass", 500, 0.9, 0, 1700);
        break;
      case "buzzer":
        this.tone(120, 0.85, "sawtooth", 0.2);
        this.tone(124, 0.85, "square", 0.1);
        break;
      case "click":
        this.tone(880, 0.05, "square", 0.07, 620);
        break;
    }
  }
}

export const sfx = new SoundKit();
