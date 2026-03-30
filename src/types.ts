export interface Track {
  id: number;
  name: string;
  color: string;
  steps: (number | string)[];
  subdivision: number; // 2, 3, or 4 steps per beat
  volume: number; // 0 to 1
}

export interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  tracks: Track[];
}
