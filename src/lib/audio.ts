export class LookoutSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  public enabled: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEnabled(next: boolean): boolean {
    if (this.enabled === next) return this.enabled;
    this.enabled = next;
    if (this.enabled) {
      this.initCtx();
      this.startAmbient();
      this.playSquelch();
    } else {
      this.stopAmbient();
    }
    return this.enabled;
  }

  public toggle(): boolean {
    return this.setEnabled(!this.enabled);
  }

  public playSquelch() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1750, this.ctx.currentTime);
      filter.Q.setValueAtTime(3.5, this.ctx.currentTime);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(780, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.07);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Ignore Web Audio errors when autoplay is blocked
    }
  }

  public playKeyClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.025);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.032);
    } catch {
      // Ignore Web Audio errors when autoplay is blocked
    }
  }

  public playVlatRadio() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.setValueAtTime(0.04, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } catch {
      // Ignore Web Audio errors when autoplay is blocked
    }
  }

  public updateThermalPower(frpMw: number) {
    if (!this.enabled || !this.ctx || !this.rumbleGain || !this.rumbleOsc) return;
    try {
      const clampedFrp = Math.max(0, frpMw);
      const targetFreq = 42 + Math.min(48, (clampedFrp / 3200) * 45);
      const targetGain = 0.007 + Math.min(0.028, (clampedFrp / 3200) * 0.025);
      this.rumbleOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.2);
      this.rumbleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
    } catch {
      // Ignore Web Audio errors when context is closed
    }
  }

  private startAmbient() {
    if (!this.ctx) return;
    this.stopAmbient();
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * white) / 1.02;
        last = data[i];
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1150;
      filter.Q.value = 1.1;

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.012, this.ctx.currentTime);

      this.noiseNode.connect(filter);
      filter.connect(this.noiseGain);
      this.noiseGain.connect(this.ctx.destination);
      this.noiseNode.start();

      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'triangle';
      this.rumbleOsc.frequency.setValueAtTime(52, this.ctx.currentTime);

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.setValueAtTime(0.008, this.ctx.currentTime);

      this.rumbleOsc.connect(this.rumbleGain);
      this.rumbleGain.connect(this.ctx.destination);
      this.rumbleOsc.start();
    } catch {
      // Ignore Web Audio errors when autoplay is blocked
    }
  }

  private stopAmbient() {
    try {
      this.noiseNode?.stop();
      this.noiseNode?.disconnect();
      this.noiseNode = null;
      this.noiseGain?.disconnect();
      this.noiseGain = null;
      this.rumbleOsc?.stop();
      this.rumbleOsc?.disconnect();
      this.rumbleOsc = null;
      this.rumbleGain?.disconnect();
      this.rumbleGain = null;
    } catch {
      // Ignore Web Audio cleanup errors
    }
  }
}

export const lookoutSound = new LookoutSoundEngine();
