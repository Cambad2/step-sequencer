import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Trash2, Sliders, Waves, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioEngine } from '../services/audioEngine';
import { Track } from '../types';

const INITIAL_TRACKS: Track[] = [
  { id: 0, name: 'Kick', color: '#ff4b4b', steps: new Array(16).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), subdivision: 4 },
  { id: 1, name: 'Snare', color: '#4b88ff', steps: new Array(16).fill(0).map((_, i) => (i % 8 === 4 ? 1 : 0)), subdivision: 4 },
  { id: 2, name: 'HiHat', color: '#f1ff4b', steps: new Array(16).fill(0).map((_, i) => (i % 2 === 0 ? 1 : 0)), subdivision: 4 },
  { id: 3, name: 'Synth', color: '#ff4bf1', steps: new Array(16).fill(0), subdivision: 4 }
];

export const Sequencer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [reverb, setReverb] = useState(0.3);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [activeSteps, setActiveSteps] = useState<number[]>(INITIAL_TRACKS.map(() => -1));

  // Refs for scheduler
  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const tracksRef = useRef(tracks);
  const trackTimingsRef = useRef<{ nextNoteTime: number; currentStep: number }[]>(
    INITIAL_TRACKS.map(() => ({ nextNoteTime: 0, currentStep: 0 }))
  );
  const timerIDRef = useRef<number | null>(null);
  const uiUpdateQueueRef = useRef<{ trackIndex: number; step: number; time: number }[]>([]);

  // Update refs when state changes
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const scheduler = useCallback(() => {
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec
    const currentTime = audioEngine.getCurrentTime();
    const instruments = audioEngine.getInstruments();

    tracksRef.current.forEach((track, i) => {
      const timing = trackTimingsRef.current[i];
      const secondsPerBeat = 60.0 / bpmRef.current;
      const stepDuration = secondsPerBeat / track.subdivision;

      while (timing.nextNoteTime < currentTime + scheduleAheadTime) {
        if (track.steps[timing.currentStep]) {
          instruments[i](timing.nextNoteTime);
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
    setTracks(tracks.map(t => ({
      ...t,
      steps: new Array(t.steps.length).fill(0).map(() => (Math.random() > 0.8 ? 1 : 0))
    })));
  };

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].steps[stepIndex] = newTracks[trackIndex].steps[stepIndex] ? 0 : 1;
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

    // Reset timing for this track if playing
    if (isPlaying) {
      trackTimingsRef.current[trackIndex] = {
        nextNoteTime: audioEngine.getCurrentTime() + 0.05,
        currentStep: 0
      };
    }
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
      newTracks[trackIndex].steps[stepIndex] = dragMode ? 1 : 0;
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

      <header className="text-center space-y-2 md:space-y-4 relative z-10">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-4xl md:text-7xl font-thin tracking-[0.2em] uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
        >
          Celestial
        </motion.h1>
        <p className="text-cyan-400/60 font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em]">
          Harmonic Frequency Sequencer
        </p>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full glass rounded-2xl md:rounded-[2rem] p-4 md:p-8 shadow-2xl space-y-6 md:space-y-10 relative z-10"
      >
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 md:pb-8 border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 w-full sm:w-auto">
            <button
              onClick={togglePlay}
              className={`group relative flex items-center justify-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-full font-light tracking-[0.2em] transition-all active:scale-95 overflow-hidden w-full sm:w-auto ${
                isPlaying 
                  ? 'text-white' 
                  : 'text-cyan-300'
              }`}
            >
              <div className={`absolute inset-0 transition-opacity duration-500 ${isPlaying ? 'bg-red-500/20 opacity-100' : 'bg-cyan-500/10 opacity-50 group-hover:opacity-100'}`} />
              <div className="relative flex items-center gap-3">
                {isPlaying ? <Square size={16} className="text-red-400" /> : <Play size={16} className="text-cyan-400" />}
                <span className="text-xs md:text-sm">{isPlaying ? 'HALT' : 'IGNITE'}</span>
              </div>
            </button>

            <div className="flex flex-col gap-2 md:gap-3 w-full sm:w-auto">
              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
                <span>Velocity</span>
                <span className="text-cyan-400">{bpm}</span>
              </div>
              <div className="flex items-center gap-3 md:gap-4 bg-white/5 px-4 md:px-6 py-2 md:py-3 rounded-full border border-white/5">
                <Sliders size={12} className="text-white/20" />
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="flex-1 sm:w-32 md:w-40 accent-cyan-400 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:gap-3 w-full sm:w-auto">
              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
                <span>Reverb</span>
                <span className="text-cyan-400">{Math.round(reverb * 100)}%</span>
              </div>
              <div className="flex items-center gap-3 md:gap-4 bg-white/5 px-4 md:px-6 py-2 md:py-3 rounded-full border border-white/5">
                <Waves size={12} className="text-white/20" />
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
                  className="flex-1 sm:w-32 md:w-40 accent-cyan-400 bg-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleRandomize}
              className="flex items-center justify-center gap-2 px-5 md:px-6 py-2 md:py-3 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] border border-cyan-500/20 w-full sm:w-auto"
            >
              <Sparkles size={12} />
              Randomize
            </button>

            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 px-5 md:px-6 py-2 md:py-3 rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80 transition-all font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] border border-white/5 w-full sm:w-auto"
            >
              <Trash2 size={12} />
              Reset Void
            </button>
          </div>
        </div>

        {/* Grid Container */}
        <div className="relative">
          <div className="overflow-x-auto pb-4 custom-scrollbar -mx-2 px-2">
            <div className="min-w-max space-y-4 md:space-y-6 pr-4">
              {tracks.map((track, trackIndex) => (
                <div key={track.id} className="flex items-center gap-3 md:gap-6 group">
                  {/* Track Label & Subdivision Selector */}
                  <div className="w-24 md:w-32 flex flex-col items-end pr-4 border-r border-white/5">
                    <div className="font-light text-[10px] md:text-[12px] uppercase tracking-[0.2em] text-white/60 group-hover:text-white transition-colors mb-2">
                      {track.name}
                    </div>
                    <div className="flex gap-2">
                      {[2, 3, 4].map(sub => (
                        <button
                          key={sub}
                          onClick={() => changeSubdivision(trackIndex, sub)}
                          className={`text-[7px] md:text-[8px] font-mono w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center transition-all border ${
                            track.subdivision === sub 
                              ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400' 
                              : 'bg-white/5 border-white/10 text-white/20 hover:text-white/60'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Steps Grid */}
                  <div className="flex gap-1.5 md:gap-2">
                    {track.steps.map((isActive, stepIndex) => (
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
                          w-8 h-8 md:w-10 md:h-10 rounded-md md:rounded-lg cursor-pointer transition-all duration-300
                          ${isActive ? '' : 'bg-white/5 hover:bg-white/10'}
                          ${activeSteps[trackIndex] === stepIndex ? 'ring-1 ring-white/50 ring-offset-2 md:ring-offset-4 ring-offset-transparent scale-110 z-10' : 'border border-white/5'}
                          ${stepIndex % track.subdivision === 0 && stepIndex !== 0 ? 'ml-2 md:ml-4' : ''}
                        `}
                        style={{
                          backgroundColor: isActive ? track.color : undefined,
                          boxShadow: isActive ? `0 0 15px ${track.color}66, 0 0 30px ${track.color}22` : undefined,
                          opacity: isActive ? 1 : 0.4
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <footer className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 px-4 md:px-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isPlaying ? 'bg-cyan-400 celestial-glow' : 'bg-white/10'}`} />
          <span className="text-[8px] md:text-[9px] font-mono text-white/20 uppercase tracking-[0.3em]">
            {isPlaying ? 'Transmission Active' : 'System Idle'}
          </span>
        </div>
        <div className="text-[8px] md:text-[9px] font-mono text-white/20 uppercase tracking-[0.3em] flex gap-4 md:gap-6">
          <span>Multi-Subdivision Engine</span>
          <span className="text-white/5">/</span>
          <span>4 Layers</span>
        </div>
      </footer>
    </div>
  );
};
