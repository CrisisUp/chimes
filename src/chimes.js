/**
 * Soft metallic chimes for string cloth interaction.
 * Country-tuned timbres (synthesized — no sample files).
 * Profiles live in ./country-chimes.json; this module imports them
 * and provides the Web Audio synthesis engine.
 */
import * as K from "./modules/constants.js";
import COUNTRY_CHIMES from "./country-chimes.json";

const FALLBACK = COUNTRY_CHIMES.china;

export class StringChimes {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.shelf = null;
    this.enabled = true;
    this.volume = K.DEFAULT_CHIME_VOLUME;
    this.countryId = "china";
    this.profile = FALLBACK;
    this.lastStrikeAt = 0;
    this.activeVoices = 0;
    this.maxVoices = 10;
    this.lastParticleId = -1;
    this.prevX = 0;
    this.prevY = 0;
  }

  setCountry(id) {
    this.countryId = id;
    this.profile = COUNTRY_CHIMES[id] || FALLBACK;
    this.lastParticleId = -1;
    if (this.shelf) {
      this.shelf.frequency.value = this.profile.shelfHz;
      this.shelf.gain.value = this.profile.shelfGain;
    }
  }

  async ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;

      this.shelf = this.ctx.createBiquadFilter();
      this.shelf.type = "highshelf";
      this.shelf.frequency.value = this.profile.shelfHz;
      this.shelf.gain.value = this.profile.shelfGain;

      this.master.connect(this.shelf);
      this.shelf.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  /**
   * @param {{ x: number, y: number, particle?: { id: number }, gridW?: number, intensity?: number, force?: boolean }} opts
   */
  async strike(opts = {}) {
    if (!this.enabled) return;
    const ok = await this.ensure();
    if (!ok || !this.ctx) return;

    const profile = this.profile;
    const now = performance.now();
    const force = !!opts.force;
    if (!force && now - this.lastStrikeAt < profile.minIntervalMs) return;
    if (this.activeVoices >= this.maxVoices) return;

    const particle = opts.particle;
    if (particle && particle.id === this.lastParticleId && !force) return;

    const dx = (opts.x ?? 0) - this.prevX;
    const dy = (opts.y ?? 0) - this.prevY;
    const speed = Math.hypot(dx, dy);
    this.prevX = opts.x ?? this.prevX;
    this.prevY = opts.y ?? this.prevY;

    let intensity = opts.intensity;
    if (intensity == null) {
      intensity = Math.min(1, 0.25 + speed / 40);
    }
    if (!force && intensity < 0.2 && speed < 1.5) return;

    this.lastStrikeAt = now;
    if (particle) this.lastParticleId = particle.id;

    const freqs = profile.freqs;
    const pitchT =
      particle && opts.gridW > 1
        ? (particle.id % opts.gridW) / (opts.gridW - 1)
        : Math.random();
    const idx = Math.min(
      freqs.length - 1,
      Math.max(
        0,
        Math.round(pitchT * (freqs.length - 1) + (Math.random() - 0.5))
      )
    );
    const freq = freqs[idx] * (0.985 + Math.random() * 0.03);

    this.#playBell(freq, intensity, profile);
  }

  #playBell(freq, intensity, profile) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = profile.duration * (0.75 + intensity * 0.5);

    const voice = ctx.createGain();
    const peak = profile.peak * (0.55 + intensity * 0.7);
    voice.gain.setValueAtTime(0.0001, t);
    voice.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + profile.attack);
    voice.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    voice.connect(this.master);

    this.activeVoices += 1;
    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, (duration + 0.05) * 1000);

    for (const { ratio, gain } of profile.partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const f0 = freq * ratio;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, f0 * profile.droop),
        t + duration
      );
      g.gain.value = gain;
      osc.connect(g);
      g.connect(voice);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }

    const noiseDur = profile.noiseDur;
    const buffer = ctx.createBuffer(
      1,
      Math.max(1, Math.floor(ctx.sampleRate * noiseDur)),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = freq * profile.noiseMul;
    noiseFilter.Q.value = profile.noiseQ;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(
      Math.max(0.0001, profile.noiseGain * intensity),
      t
    );
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(voice);
    noise.start(t);
    noise.stop(t + noiseDur + 0.01);
  }
}

export const chimes = new StringChimes();
