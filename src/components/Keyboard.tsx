import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Music, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface KeyboardProps {
  pulse?: number;
  bpm?: number;
}

const NOTES = [
  { note: 'C3', isBlack: false, key: 'q' },
  { note: 'C#3', isBlack: true, key: 'z' },
  { note: 'D3', isBlack: false, key: 's' },
  { note: 'D#3', isBlack: true, key: 'e' },
  { note: 'E3', isBlack: false, key: 'd' },
  { note: 'F3', isBlack: false, key: 'f' },
  { note: 'F#3', isBlack: true, key: 't' },
  { note: 'G3', isBlack: false, key: 'g' },
  { note: 'G#3', isBlack: true, key: 'y' },
  { note: 'A3', isBlack: false, key: 'h' },
  { note: 'A#3', isBlack: true, key: 'u' },
  { note: 'B3', isBlack: false, key: 'j' },
  { note: 'C4', isBlack: false, key: 'k' },
  { note: 'C#4', isBlack: true, key: 'o' },
  { note: 'D4', isBlack: false, key: 'l' },
  { note: 'D#4', isBlack: true, key: 'p' },
  { note: 'E4', isBlack: false, key: 'm' },
  { note: 'F4', isBlack: false, key: 'ù' },
];

export const Keyboard: React.FC<KeyboardProps> = ({ pulse, bpm = 120 }) => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [isChordMode, setIsChordMode] = useState(true);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [brightness, setBrightness] = useState(0.5);
  
  // Use a ref for mode to avoid re-attaching event listeners
  const modeRef = useRef(isChordMode);
  const volumeRef = useRef(volume);
  const brightnessRef = useRef(brightness);

  useEffect(() => { modeRef.current = isChordMode; }, [isChordMode]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { brightnessRef.current = brightness; }, [brightness]);

  const playNote = (note: string) => {
    // Call init once to ensure context is running, but it's fast
    audioEngine.init();
    // Add a tiny 5ms offset for the Web Audio scheduler to avoid jitter
    const now = audioEngine.getCurrentTime() + 0.005;
    
    // We'll pass brightness as a multiplier for the filter frequency
    audioEngine.playSynth(now, note, volumeRef.current, modeRef.current ? 'chord' : 'note', brightnessRef.current);
    
    // Snappier visual feedback
    setActiveNote(note);
    setTimeout(() => setActiveNote(null), 100);
  };

  // Auto-play logic (synced to sequencer)
  useEffect(() => {
    if (isAutoPlay && pulse !== undefined && pulse !== -1) {
      if (pulse % 2 === 0 && Math.random() > 0.3) {
        const randomNote = NOTES[Math.floor(Math.random() * NOTES.length)].note;
        playNote(randomNote);
      }
    }
  }, [pulse, isAutoPlay]);

  // Standalone auto-play logic (when sequencer is off)
  useEffect(() => {
    if (isAutoPlay && (pulse === undefined || pulse === -1)) {
      // 8th note interval: (60 / bpm) / 2 * 1000 ms
      const intervalMs = (60 / bpm) / 2 * 1000;
      
      const interval = setInterval(() => {
        if (Math.random() > 0.3) {
          const randomNote = NOTES[Math.floor(Math.random() * NOTES.length)].note;
          playNote(randomNote);
        }
      }, intervalMs);

      return () => clearInterval(interval);
    }
  }, [isAutoPlay, pulse, bpm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent repeat triggers on long press
      if (e.repeat) return;
      
      const noteObj = NOTES.find(n => n.key === e.key.toLowerCase());
      if (noteObj) {
        playNote(noteObj.note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // No longer depends on isChordMode thanks to modeRef

  return (
    <div className="mt-12 pt-12 border-t border-border-main relative" id="keyboard-zone">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3">
          <Music className="w-4 h-4 text-accent" />
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-dim">
            Celestial Keyboard
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4 bg-surface px-4 py-2 rounded-full border border-border-main">
            <span className="text-[8px] font-mono text-dim uppercase tracking-widest">Volume</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-accent bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4 bg-surface px-4 py-2 rounded-full border border-border-main">
            <span className="text-[8px] font-mono text-dim uppercase tracking-widest">Brightness / Noise</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={brightness} 
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              className="w-24 accent-accent bg-transparent cursor-pointer"
            />
          </div>

          <button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-mono uppercase tracking-widest transition-all border ${
              isAutoPlay 
                ? 'bg-accent text-black border-accent shadow-[0_0_10px_var(--accent-glow)]' 
                : 'bg-surface text-dim border-border-main hover:border-white/30'
            }`}
          >
            <Sparkles size={10} className={isAutoPlay ? 'animate-pulse' : ''} />
            Celestial Jam
          </button>

          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-mono uppercase tracking-widest ${!isChordMode ? 'text-accent' : 'text-dim'}`}>Note</span>
            <button 
              onClick={() => setIsChordMode(!isChordMode)}
              className="w-8 h-4 bg-surface rounded-full relative border border-border-main transition-colors hover:bg-surface-hover"
            >
              <motion.div 
                animate={{ x: isChordMode ? 16 : 0 }}
                className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent-glow)]"
              />
            </button>
            <span className={`text-[8px] font-mono uppercase tracking-widest ${isChordMode ? 'text-accent' : 'text-dim'}`}>Chord</span>
          </div>
        </div>
      </div>

      <div className="relative flex justify-center pb-8 overflow-x-auto custom-scrollbar">
        <div className="relative flex h-32 md:h-48 min-w-max px-4">
          {NOTES.map(({ note, isBlack, key }) => (
            <button
              key={note}
              onMouseDown={() => playNote(note)}
              onTouchStart={(e) => {
                e.preventDefault();
                playNote(note);
              }}
              className={`
                relative transition-all duration-100 flex flex-col items-center justify-end pb-4
                ${isBlack 
                  ? 'w-6 md:w-8 h-20 md:h-28 -mx-3 md:-mx-4 z-20 rounded-b-md border border-border-main' 
                  : 'w-10 md:w-14 h-full z-10 rounded-b-lg border border-border-main'
                }
                ${activeNote === note 
                  ? 'bg-accent scale-95' 
                  : ''
                }
              `}
              style={{
                backgroundColor: activeNote === note ? 'var(--accent-primary)' : (isBlack ? 'var(--key-black)' : 'var(--key-white)'),
                boxShadow: activeNote === note 
                  ? `0 0 20px var(--accent-glow)` 
                  : isBlack 
                    ? '0 4px 12px rgba(0,0,0,0.5)' 
                    : '0 4px 12px var(--glass-shadow)'
              }}
            >
              <span className={`text-[8px] font-bold mb-1 ${isBlack ? 'text-accent' : 'text-accent'}`}>
                {key.toUpperCase()}
              </span>
              <span className={`text-[7px] font-mono uppercase tracking-tighter ${isBlack ? 'text-white/90' : 'text-main'}`}>
                {note}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-[8px] font-mono text-dim uppercase tracking-[0.2em]">
        <span>Polyphonic Synthesis</span>
        <span>•</span>
        <span>PC Keyboard Mapping Enabled</span>
      </div>
    </div>
  );
};
