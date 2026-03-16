export interface Track {
  id: number;
  name: string;
  color: string;
  steps: number[];
  subdivision: number; // 2, 3, or 4 steps per beat
}

export interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  tracks: Track[];
}
