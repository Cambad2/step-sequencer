/**
 * Web Audio API Engine for the Step Sequencer
 */

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.createNoiseBuffer();
      this.setupMasterChain();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private setupMasterChain() {
    if (!this.audioCtx) return;

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.8;

    this.reverbNode = this.audioCtx.createConvolver();
    this.reverbGain = this.audioCtx.createGain();
    this.dryGain = this.audioCtx.createGain();

    // Create a simple impulse response for reverb
    const length = this.audioCtx.sampleRate * 2; // 2 seconds
    const impulse = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    this.reverbNode.buffer = impulse;

    // Routing
    this.masterGain.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    this.masterGain.connect(this.dryGain);

    this.reverbGain.connect(this.audioCtx.destination);
    this.dryGain.connect(this.audioCtx.destination);

    // Default levels
    this.reverbGain.gain.value = 0.3;
    this.dryGain.gain.value = 0.7;
  }

  setReverbLevel(level: number) {
    if (!this.reverbGain || !this.dryGain) return;
    // level is 0 to 1
    this.reverbGain.gain.setTargetAtTime(level * 0.8, this.audioCtx!.currentTime, 0.1);
    this.dryGain.gain.setTargetAtTime(1 - level * 0.5, this.audioCtx!.currentTime, 0.1);
  }

  private createNoiseBuffer() {
    if (!this.audioCtx) return;
    const bufferSize = this.audioCtx.sampleRate * 2;
    this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  getCurrentTime() {
    return this.audioCtx?.currentTime || 0;
  }

  playKick(time: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);

    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time: number) {
    if (!this.audioCtx || !this.masterGain) return;
    // Tone
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.frequency.setValueAtTime(250, time);
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.start(time);
    osc.stop(time + 0.2);

    // Noise
    if (!this.noiseBuffer) return;
    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = this.audioCtx.createGain();

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noiseSource.start(time);
    noiseSource.stop(time + 0.2);
  }

  playHiHat(time: number) {
    if (!this.audioCtx || !this.noiseBuffer || !this.masterGain) return;
    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 5000;
    const gainNode = this.audioCtx.createGain();

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(gainNode);
    gainNode.connect(this.masterGain);

    gainNode.gain.setValueAtTime(0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noiseSource.start(time);
    noiseSource.stop(time + 0.05);
  }

  playSynth(time: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, time); // A4
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.linearRampToValueAtTime(0, time + 0.2);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  getInstruments() {
    return [
      (t: number) => this.playKick(t),
      (t: number) => this.playSnare(t),
      (t: number) => this.playHiHat(t),
      (t: number) => this.playSynth(t)
    ];
  }
}

export const audioEngine = new AudioEngine();
