import type { Difficulty, Mode } from "./game/engine";

export interface Bests {
  time: number;
  free: number;
  streak: number;
}

export interface BestRecord {
  score: number;
  difficulty: Difficulty;
  accuracy: number;
}

export const bestKey = (mode: Mode, difficulty: Difficulty) => `hoop-legends:${mode}:${difficulty}`;
