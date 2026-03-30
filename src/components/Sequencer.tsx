import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Trash2, Sliders, Waves, Sparkles, Volume2, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioEngine } from '../services/audioEngine';
import { Track } from '../types';
import { BouncingBallZone } from './BouncingBallZone';
import { Keyboard } from './Keyboard';

const INITIAL_TRACKS: Track[] = [
  { id: 0, name: 'Kick', color: '#ff4b4b', steps: new Array(16).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), subdivision: 4, volume: 0.8 },
  { id: 1, name: 'Snare', color: '#4b88ff', steps: new Array(16).fill(0).map((_, i) => (i % 8 === 4 ? 1 : 0)), subdivision: 4, volume: 0.6 },
  { id: 2, name: 'HiHat', color: '#f1ff4b', steps: new Array(16).fill(0).map((_, i) => (i % 2 === 0 ? 1 : 0)), subdivision: 4, volume: 0.4 },
  { id: 3, name: 'Synth', color: '#ff4bf1', steps: new Array(16).fill(0), subdivision: 4, volume: 0.5 }
];

const SYNTH_NOTES = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];

export const Sequencer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [reverb, setReverb] = useState(0.3);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [activeSteps, setActiveSteps] = useState<number[]>(INITIAL_TRACKS.map(() => -1));
  const [selectedNote, setSelectedNote] = useState('C4');
  const [synthMode, setSynthMode] = useState<'chord' | 'arpeggio'>('chord');
  const [isLightMode, setIsLightMode] = useState(false);

  // Theme toggle
  const toggleTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  // Refs for scheduler
  const globalStartTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const tracksRef = useRef(tracks);
  const synthModeRef = useRef(synthMode);
  const trackTimingsRef = useRef<{ nextNoteTime: number; currentStep: number }[]>(
    INITIAL_TRACKS.map(() => ({ nextNoteTime: 0, currentStep: 0 }))
  );
  const timerIDRef = useRef<number | null>(null);
  const uiUpdateQueueRef = useRef<{ trackIndex: number; step: number; time: number }[]>([]);

  // Update refs when state changes
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { synthModeRef.current = synthMode; }, [synthMode]);

  const scheduler = useCallback(() => {
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec
    const currentTime = audioEngine.getCurrentTime();
    const instruments = audioEngine.getInstruments(synthModeRef.current);

    tracksRef.current.forEach((track, i) => {
      const timing = trackTimingsRef.current[i];
      const secondsPerBeat = 60.0 / bpmRef.current;
      const stepDuration = secondsPerBeat / track.subdivision;

      while (timing.nextNoteTime < currentTime + scheduleAheadTime) {
        const stepValue = track.steps[timing.currentStep];
        if (stepValue) {
          instruments[i](timing.nextNoteTime, track.volume, stepValue);
        }
        uiUpdateQueueRef.current.push({ trackIndex: i, step: timing.currentStep, time: timing.nextNoteTime });
        
        timing.nextNoteTime += stepDuration;
        timing.currentStep = (timing.currentStep + 1) % track.steps.length;
      }
    });

    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const drawUI = () => {
      if (isPlayingRef.current) {
        const currentTime = audioEngine.getCurrentTime();
        while (uiUpdateQueueRef.current.length && uiUpdateQueueRef.current[0].time < currentTime) {
          const { trackIndex, step } = uiUpdateQueueRef.current[0];
          setActiveSteps(prev => {
            const next = [...prev];
            next[trackIndex] = step;
            return next;
          });
          uiUpdateQueueRef.current.shift();
        }
      }
      animationFrameId = requestAnimationFrame(drawUI);
    };
    animationFrameId = requestAnimationFrame(drawUI);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const togglePlay = () => {
    audioEngine.init();
    if (!isPlaying) {
      const startTime = audioEngine.getCurrentTime() + 0.05;
      globalStartTimeRef.current = startTime;
      trackTimingsRef.current = tracks.map(() => ({
        nextNoteTime: startTime,
        currentStep: 0
      }));
      scheduler();
    } else {
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      setActiveSteps(tracks.map(() => -1));
    }
    setIsPlaying(!isPlaying);
  };

  const handleClear = () => {
    setTracks(tracks.map(t => ({ ...t, steps: new Array(t.steps.length).fill(0) })));
  };

  const handleRandomize = () => {
    // Randomize global parameters
    const newBpm = Math.floor(Math.random() * 80) + 80; // 80 - 160
    const newReverb = Math.random() * 0.6 + 0.1; // 0.1 - 0.7
    
    setBpm(newBpm);
    setReverb(newReverb);
    audioEngine.init();
    audioEngine.setReverbLevel(newReverb);

    // Randomize UI selected note
    const newSelectedNote = SYNTH_NOTES[Math.floor(Math.random() * SYNTH_NOTES.length)];
    setSelectedNote(newSelectedNote);

    const newTracks = tracks.map((t, trackIndex) => {
      const newSub = [2, 3, 4][Math.floor(Math.random() * 3)];
      const newLength = newSub * 4;
      const newVolume = Math.random() * 0.6 + 0.3; // 0.3 - 0.9

      const newSteps = new Array(newLength).fill(0).map((_, i) => {
        let probability = 0.15; // Default

        if (t.name === 'Kick') {
          // Higher probability on main beats
          if (i % newSub === 0) probability = 0.7;
          else if (i % (newSub / 2) === 0) probability = 0.3;
        } else if (t.name === 'Snare') {
          // Higher probability on backbeats (2 and 4)
          if (i === newSub || i === newSub * 3) probability = 0.8;
          else if (i % newSub === 0) probability = 0.2;
        } else if (t.name === 'HiHat') {
          probability = 0.6;
          if (i % 2 === 0) probability = 0.8;
        } else if (t.name === 'Synth') {
          probability = 0.25;
        }

        if (Math.random() < probability) {
          if (t.name === 'Synth') {
            return SYNTH_NOTES[Math.floor(Math.random() * SYNTH_NOTES.length)];
          }
          return 1;
        }
        return 0;
      });

      // Synchronize timing for this track if playing
      if (isPlaying) {
        const secondsPerBeat = 60.0 / newBpm;
        const stepDuration = secondsPerBeat / newSub;
        const currentTime = audioEngine.getCurrentTime();
        
        // Calculate how many steps of the NEW subdivision have passed since global start
        const elapsed = currentTime - globalStartTimeRef.current;
        const stepsPassed = elapsed / stepDuration;
        const nextStepIndex = Math.ceil(stepsPassed);
        
        trackTimingsRef.current[trackIndex] = {
          nextNoteTime: globalStartTimeRef.current + (nextStepIndex * stepDuration),
          currentStep: nextStepIndex % newLength
        };
      }

      return {
        ...t,
        subdivision: newSub,
        steps: newSteps,
        volume: newVolume
      };
    });
    setTracks(newTracks);
  };

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    const newTracks = [...tracks];
    const track = newTracks[trackIndex];
    
    if (track.name === 'Synth') {
      // If it's already the selected note, turn it off
      if (track.steps[stepIndex] === selectedNote) {
        track.steps[stepIndex] = 0;
      } else {
        // Otherwise, set it to the selected note
        track.steps[stepIndex] = selectedNote;
        // Play the note for feedback
        audioEngine.init();
        audioEngine.playSynth(audioEngine.getCurrentTime(), selectedNote, 1, synthMode);
      }
    } else {
      track.steps[stepIndex] = track.steps[stepIndex] ? 0 : 1;
    }
    
    setTracks(newTracks);
  };

  const changeSubdivision = (trackIndex: number, sub: number) => {
    const newTracks = [...tracks];
    const track = newTracks[trackIndex];
    const oldSub = track.subdivision;
    track.subdivision = sub;
    
    // Resize steps array (4 beats)
    const newLength = sub * 4;
    const newSteps = new Array(newLength).fill(0);
    
    // Try to preserve some steps if possible (simple mapping)
    track.steps.forEach((val, i) => {
      const ratio = i / (oldSub * 4);
      const newIdx = Math.floor(ratio * newLength);
      if (val && newIdx < newLength) newSteps[newIdx] = 1;
    });
    
    track.steps = newSteps;
    setTracks(newTracks);

    // Synchronize timing for this track if playing
    if (isPlaying) {
      const secondsPerBeat = 60.0 / bpmRef.current;
      const stepDuration = secondsPerBeat / sub;
      const currentTime = audioEngine.getCurrentTime();
      
      // Calculate how many steps of the NEW subdivision have passed since global start
      const elapsed = currentTime - globalStartTimeRef.current;
      const stepsPassed = elapsed / stepDuration;
      const nextStepIndex = Math.ceil(stepsPassed);
      
      trackTimingsRef.current[trackIndex] = {
        nextNoteTime: globalStartTimeRef.current + (nextStepIndex * stepDuration),
        currentStep: nextStepIndex % newLength
      };
    }
  };

  const changeVolume = (trackIndex: number, vol: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].volume = vol;
    setTracks(newTracks);
  };

  // Drag to draw logic
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true);

  const onStepMouseDown = (trackIndex: number, stepIndex: number) => {
    setIsDragging(true);
    const newMode = !tracks[trackIndex].steps[stepIndex];
    setDragMode(newMode);
    toggleStep(trackIndex, stepIndex);
  };

  const onStepMouseEnter = (trackIndex: number, stepIndex: number) => {
    if (isDragging) {
      const newTracks = [...tracks];
      const track = newTracks[trackIndex];
      if (track.name === 'Synth') {
        track.steps[stepIndex] = dragMode ? selectedNote : 0;
        if (dragMode) {
          audioEngine.init();
          audioEngine.playSynth(audioEngine.getCurrentTime(), selectedNote, 1, synthMode);
        }
      } else {
        track.steps[stepIndex] = dragMode ? 1 : 0;
      }
      setTracks(newTracks);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center w-full max-w-5xl p-4 md:p-6 space-y-8 md:space-y-12">
      {/* Background Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div 
            key={i}
            className="star"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <header className="text-center space-y-1 md:space-y-4 relative z-10 w-full flex flex-col items-center">
        <div className="absolute right-0 top-0">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full glass hover:scale-110 transition-transform text-accent"
          >
            {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-3xl md:text-7xl font-thin tracking-[0.2em] uppercase text-main drop-shadow-[0_0_15px_var(--accent-glow)]"
        >
          Celestial
        </motion.h1>
        <p className="text-accent/60 font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em]">
          Harmonic Frequency Sequencer
        </p>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full glass rounded-2xl md:rounded-[2rem] p-4 md:p-8 shadow-2xl space-y-6 md:space-y-10 relative z-10"
      >
        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 md:pb-8 border-b border-border-main">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full lg:w-auto">
            <div className="flex flex-col gap-2 md:gap-3 w-full md:w-auto">
              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-mono text-dim uppercase tracking-[0.2em]">
                <span>Velocity</span>
                <span className="text-accent">{bpm}</span>
              </div>
              <div className="flex items-center gap-3 md:gap-4 bg-surface px-4 md:px-6 py-2 md:py-3 rounded-full border border-border-main">
                <Sliders size={12} className="text-dim" />
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="flex-1 w-full md:w-32 lg:w-40 accent-accent bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:gap-3 w-full md:w-auto">
              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-mono text-dim uppercase tracking-[0.2em]">
                <span>Reverb</span>
                <span className="text-accent">{Math.round(reverb * 100)}%</span>
              </div>
              <div className="flex items-center gap-3 md:gap-4 bg-surface px-4 md:px-6 py-2 md:py-3 rounded-full border border-border-main">
                <Waves size={12} className="text-dim" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reverb * 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) / 100;
                    setReverb(val);
                    audioEngine.init();
                    audioEngine.setReverbLevel(val);
                  }}
                  className="flex-1 w-full md:w-32 lg:w-40 accent-accent bg-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 w-full lg:w-auto">
            <button
              onClick={handleRandomize}
              className="flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-all font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] border border-accent/20 w-full md:w-auto"
            >
              <Sparkles size={12} />
              Randomize
            </button>

            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-surface text-dim hover:bg-surface-hover hover:text-main transition-all font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] border border-border-main w-full md:w-auto"
            >
              <Trash2 size={12} />
              Reset Void
            </button>
          </div>
        </div>

        {/* Synth Note Selector */}
        <div className="flex flex-col gap-4 py-4 md:py-6 border-b border-border-main">
          <div className="text-[10px] md:text-[12px] font-mono text-dim uppercase tracking-[0.3em] text-center">
            Synth Frequency Selection
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {SYNTH_NOTES.map(note => (
              <button
                key={note}
                onClick={() => {
                  setSelectedNote(note);
                  audioEngine.init();
                  audioEngine.playSynth(audioEngine.getCurrentTime(), note, 1, synthMode);
                }}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[12px] font-mono transition-all border ${
                  selectedNote === note 
                    ? 'bg-accent text-black border-accent shadow-[0_0_15px_var(--accent-glow)]' 
                    : 'bg-surface text-dim border-border-main hover:border-white/30 hover:text-main'
                }`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Container */}
        <div className="relative space-y-6">
          <div className="flex justify-center md:justify-start">
            <button
              onClick={togglePlay}
              className={`group relative flex items-center justify-center gap-3 px-8 py-3 rounded-full font-light tracking-[0.2em] transition-all active:scale-95 overflow-hidden border ${
                isPlaying 
                  ? 'text-main border-red-500/30' 
                  : 'text-accent border-accent/30'
              }`}
            >
              <div className={`absolute inset-0 transition-opacity duration-500 ${isPlaying ? 'bg-red-500/20 opacity-100' : 'bg-accent/10 opacity-50 group-hover:opacity-100'}`} />
              <div className="relative flex items-center gap-3">
                {isPlaying ? <Square size={14} className="text-red-400" /> : <Play size={14} className="text-accent" />}
                <span className="text-[10px] md:text-xs">{isPlaying ? 'HALT' : 'IGNITE'}</span>
              </div>
            </button>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar -mx-2 px-2">
            <div className="min-w-max space-y-4 md:space-y-6 pr-4">
              {tracks.map((track, trackIndex) => (
                <div key={track.id} className="flex items-center gap-3 md:gap-6 group">
                  {/* Track Label & Controls */}
                  <div className="w-32 md:w-40 flex flex-col items-end pr-4 border-r border-border-main">
                    <div className="flex flex-col items-end mb-2">
                      <div className="font-light text-[10px] md:text-[12px] uppercase tracking-[0.2em] text-dim group-hover:text-main transition-colors">
                        {track.name}
                      </div>
                      {track.name === 'Synth' && (
                        <div className="flex bg-surface p-0.5 rounded-lg border border-border-main mt-1">
                          <button
                            onClick={() => setSynthMode('chord')}
                            className={`px-2 py-0.5 rounded-md text-[7px] font-mono transition-all ${
                              synthMode === 'chord' ? 'bg-accent text-black' : 'text-dim hover:text-main'
                            }`}
                          >
                            CHORD
                          </button>
                          <button
                            onClick={() => setSynthMode('arpeggio')}
                            className={`px-2 py-0.5 rounded-md text-[7px] font-mono transition-all ${
                              synthMode === 'arpeggio' ? 'bg-accent text-black' : 'text-dim hover:text-main'
                            }`}
                          >
                            ARP
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full items-end">
                      {/* Subdivision */}
                      <div className="flex gap-1.5">
                        {[2, 3, 4].map(sub => (
                          <button
                            key={sub}
                            onClick={() => changeSubdivision(trackIndex, sub)}
                            className={`text-[7px] md:text-[8px] font-mono w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center transition-all border ${
                              track.subdivision === sub 
                                ? 'bg-accent/20 border-accent text-accent' 
                                : 'bg-surface border-border-main text-dim hover:text-main'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>

                      {/* Volume Slider */}
                      <div className="flex items-center gap-2 w-full max-w-[80px] md:max-w-[100px]">
                        <Volume2 size={10} className="text-dim" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={track.volume * 100}
                          onChange={(e) => changeVolume(trackIndex, parseInt(e.target.value) / 100)}
                          className="w-full h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Steps Grid */}
                  <div className="flex-1 flex gap-2 md:gap-4 min-w-[600px] md:min-w-[800px]">
                    {Array.from({ length: 4 }).map((_, beatIndex) => (
                      <div key={beatIndex} className="flex-1 flex gap-1 md:gap-1.5">
                        {track.steps.slice(beatIndex * track.subdivision, (beatIndex + 1) * track.subdivision).map((isActive, subStepIndex) => {
                          const stepIndex = beatIndex * track.subdivision + subStepIndex;
                          return (
                            <div
                              key={stepIndex}
                              id={`step-${trackIndex}-${stepIndex}`}
                              onMouseDown={() => onStepMouseDown(trackIndex, stepIndex)}
                              onMouseEnter={() => onStepMouseEnter(trackIndex, stepIndex)}
                              onTouchStart={(e) => {
                                e.preventDefault();
                                onStepMouseDown(trackIndex, stepIndex);
                              }}
                              className={`
                                flex-1 h-8 md:h-10 rounded-md md:rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center
                                ${isActive ? '' : 'bg-surface hover:bg-surface-hover'}
                                ${activeSteps[trackIndex] === stepIndex ? 'ring-1 ring-accent/50 ring-offset-2 md:ring-offset-4 ring-offset-transparent scale-110 z-10' : 'border border-border-main'}
                              `}
                              style={{
                                backgroundColor: isActive ? track.color : undefined,
                                boxShadow: isActive ? `0 0 15px ${track.color}66, 0 0 30px ${track.color}22` : undefined,
                                opacity: isActive ? 1 : 0.4
                              }}
                            >
                              {track.name === 'Synth' && isActive && (
                                <span className="text-[7px] md:text-[9px] font-mono text-black/60 font-bold">
                                  {isActive}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <BouncingBallZone bpm={bpm} />
        <Keyboard pulse={activeSteps[3]} bpm={bpm} />
      </motion.div>

      <footer className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 px-4 md:px-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isPlaying ? 'bg-accent celestial-glow' : 'bg-surface-hover'}`} />
          <span className="text-[8px] md:text-[9px] font-mono text-dim uppercase tracking-[0.3em]">
            {isPlaying ? 'Transmission Active' : 'System Idle'}
          </span>
        </div>
        <div className="text-[8px] md:text-[9px] font-mono text-dim uppercase tracking-[0.3em] flex gap-4 md:gap-6">
          <span>Multi-Subdivision Engine</span>
          <span className="text-dim/20">/</span>
          <span>4 Layers</span>
        </div>
      </footer>
    </div>
  );
};
