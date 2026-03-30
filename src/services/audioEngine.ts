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

  getAudioContext() {
    return this.audioCtx;
  }

  playKick(time: number, volume: number = 1) {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);

    gainNode.gain.setValueAtTime(volume, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time: number, volume: number = 1) {
    if (!this.audioCtx || !this.masterGain) return;
    // Tone
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.frequency.setValueAtTime(250, time);
    oscGain.gain.setValueAtTime(0.5 * volume, time);
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

    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noiseSource.start(time);
    noiseSource.stop(time + 0.2);
  }

  playHiHat(time: number, volume: number = 1) {
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

    gainNode.gain.setValueAtTime(0.3 * volume, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noiseSource.start(time);
    noiseSource.stop(time + 0.05);
  }

  playSynth(time: number, frequency: number | string = 440, volume: number = 1, mode: 'chord' | 'arpeggio' | 'note' = 'chord', brightness: number = 0.5) {
    if (!this.audioCtx || !this.masterGain) return;
    
    // Ensure context is running
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const getFreq = (noteName: string): number => {
      const match = noteName.match(/^([A-G]#?)(\d)$/);
      if (!match) return 440;
      const name = match[1];
      const octave = parseInt(match[2]);
      const index = NOTE_NAMES.indexOf(name);
      const midi = (octave + 1) * 12 + index;
      return 440 * Math.pow(2, (midi - 69) / 12);
    };

    const getChordFrequencies = (root: string): number[] => {
      const match = root.match(/^([A-G]#?)(\d)$/);
      if (!match) return [440];
      const name = match[1];
      const octave = parseInt(match[2]);
      const keyIndex = NOTE_NAMES.indexOf(name);
      
      const isDiatonic = !name.includes('#');
      
      if (isDiatonic) {
        // Diatonic triads in C Major
        const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const rootIdx = scale.indexOf(name);
        // 1st, 3rd, 5th in scale
        const notes = [
          root,
          scale[(rootIdx + 2) % 7] + (octave + (rootIdx + 2 >= 7 ? 1 : 0)),
          scale[(rootIdx + 4) % 7] + (octave + (rootIdx + 4 >= 7 ? 1 : 0))
        ];
        return notes.map(getFreq);
      } else {
        // Major triad for accidentals
        return [0, 4, 7].map(interval => {
          const midi = (octave + 1) * 12 + keyIndex + interval;
          return 440 * Math.pow(2, (midi - 69) / 12);
        });
      }
    };

    let frequencies: number[] = [];
    if (typeof frequency === 'string') {
      if (mode === 'note') {
        frequencies = [getFreq(frequency)];
      } else {
        frequencies = getChordFrequencies(frequency);
      }
    } else {
      frequencies = [frequency];
    }

    if (mode === 'chord' || mode === 'note') {
      frequencies.forEach(freq => {
        // Use triangle for single notes (softer), sawtooth for chords (richer)
        const type = mode === 'note' ? 'triangle' : 'sawtooth';
        this.playSingleSynthNote(time, freq, volume / (mode === 'chord' ? frequencies.length : 1), false, type, brightness);
      });
    } else {
      // Arpeggio
      const arpSpeed = 0.04;
      frequencies.forEach((freq, i) => {
        this.playSingleSynthNote(time + i * arpSpeed, freq, volume * 1.2, true, 'sawtooth', brightness);
      });
    }
  }

  private playSingleSynthNote(time: number, freq: number, volume: number, isArp: boolean, type: OscillatorType = 'sawtooth', brightness: number = 0.5) {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    // Brightness controls filter cutoff
    const baseCutoff = isArp ? 5000 : 3000;
    const cutoff = baseCutoff * (0.2 + brightness * 2); // 0.2 to 2.2x base
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.1, time + 0.4);
    filter.Q.setValueAtTime(brightness * 15, time); // Increased resonance for "noisier" feel

    osc.connect(filter);
    
    // Add noise layer if brightness is high
    if (brightness > 0.6 && this.noiseBuffer) {
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseGain = this.audioCtx.createGain();
      const noiseFilter = this.audioCtx.createBiquadFilter();
      
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(freq * 2, time);
      
      noiseGain.gain.setValueAtTime(0, time);
      noiseGain.gain.linearRampToValueAtTime((brightness - 0.6) * 0.1 * volume, time + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(gainNode);
      noise.start(time);
      noise.stop(time + 0.2);
    }

    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Snappier envelope for better reactivity
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.2 * volume, time + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  playPing(time: number, frequency: number = 880, volume: number = 0.5) {
    if (!this.audioCtx || !this.masterGain) return;
    
    // Ensure context is running
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, time + 0.1);
    
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }

  getInstruments(synthMode: 'chord' | 'arpeggio' = 'chord') {
    return [
      (t: number, v: number) => this.playKick(t, v),
      (t: number, v: number) => this.playSnare(t, v),
      (t: number, v: number) => this.playHiHat(t, v),
      (t: number, v: number, val?: number | string) => this.playSynth(t, val, v, synthMode)
    ];
  }
}

export const audioEngine = new AudioEngine();
