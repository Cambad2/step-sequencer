import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  frequency: number;
}

interface BouncingBallZoneProps {
  bpm: number;
}

const COLORS = [
  '#FF6321', // Orange
  '#00FF00', // Neon Green
  '#F27D26', // Warm Orange
  '#FF4444', // Red
  '#4444FF', // Blue
  '#FFFF44', // Yellow
];

const FREQUENCIES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
];

export const BouncingBallZone: React.FC<BouncingBallZoneProps> = ({ bpm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const ballsRef = useRef<Ball[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmRef = useRef(bpm);

  // Sync refs with state/props for the animation loop
  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const addBall = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize audio engine on first interaction
    audioEngine.init();

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newBall: Ball = {
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      radius: 8 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      frequency: FREQUENCIES[Math.floor(Math.random() * FREQUENCIES.length)],
    };

    setBalls(prev => [...prev, newBall]);
  };

  const clearBalls = () => {
    setBalls([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      const width = canvas.width;
      const height = canvas.height;
      const speedMultiplier = bpmRef.current / 120;

      // Clear canvas with theme-aware trail
      const isLight = document.documentElement.classList.contains('light');
      ctx.fillStyle = isLight ? 'rgba(250, 250, 249, 0.2)' : 'rgba(2, 6, 23, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const currentBalls = ballsRef.current;
      
      currentBalls.forEach(ball => {
        // Move scaled by BPM
        ball.x += ball.vx * speedMultiplier;
        ball.y += ball.vy * speedMultiplier;

        let hit = false;

        // Bounce X
        if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx *= -1;
          hit = true;
        } else if (ball.x + ball.radius > width) {
          ball.x = width - ball.radius;
          ball.vx *= -1;
          hit = true;
        }

        // Bounce Y
        if (ball.y - ball.radius < 0) {
          ball.y = ball.radius;
          ball.vy *= -1;
          hit = true;
        } else if (ball.y + ball.radius > height) {
          ball.y = height - ball.radius;
          ball.vy *= -1;
          hit = true;
        }

        if (hit) {
          audioEngine.playPing(audioEngine.getAudioContext()?.currentTime || 0, ball.frequency, 0.3);
        }

        // Draw
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ball.color;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0; // Reset shadow for next draws
      });

      animationFrameId = requestAnimationFrame(update);
    };

    const handleResize = () => {
      if (containerRef.current && canvas) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = 300; // Fixed height for the zone
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="mt-12 pt-12 border-t border-border-main relative"
      id="bouncing-ball-zone"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-dim">
            Bouncing Ball Synth
          </h2>
        </div>
        <button 
          onClick={clearBalls}
          className="p-2 hover:bg-surface rounded-full transition-colors text-dim hover:text-main"
          title="Clear all balls"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="relative group">
        <canvas 
          ref={canvasRef}
          onClick={addBall}
          className="w-full h-[250px] cursor-crosshair rounded-2xl bg-surface border border-border-main"
        />
        {balls.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-dim/50 font-mono text-[8px] uppercase tracking-[0.4em]">
              Click to spawn celestial bodies
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4 text-[8px] font-mono text-dim uppercase tracking-[0.2em]">
        <span>Active Entities: {balls.length}</span>
        <span>•</span>
        <span>Collision triggers frequency</span>
      </div>
    </div>
  );
};
