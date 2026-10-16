import { useState } from "react";
import { DIFFICULTIES, MODES, type Difficulty, type Mode } from "../game/engine";
import type { Bests } from "../types";

interface Props {
  bests: Bests;
  soundOn: boolean;
  onToggleSound: () => void;
  onStart: (mode: Mode, difficulty: Difficulty) => void;
}

const MODE_ORDER: Mode[] = ["time", "free", "streak"];
const DIFF_ORDER: Difficulty[] = ["rookie", "pro", "legend"];

export default function Menu({ bests, soundOn, onToggleSound, onStart }: Props) {
  const [mode, setMode] = useState<Mode>("time");
  const [diff, setDiff] = useState<Difficulty>("pro");

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-10">
      {/* Title */}
      <div className="anim-rise mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-orange-500/70" />
          <span className="text-[11px] font-bold tracking-[0.45em] text-orange-400/90">
            STREET COURT · NIGHT SESSION
          </span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-orange-500/70" />
        </div>
        <h1 className="font-display text-6xl leading-none tracking-wide text-white hard-shadow sm:text-8xl">
          HOOP <span className="text-shimmer">LEGENDS</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
          Drag, release, and rain buckets. Real arc physics, iron rims that rattle and a crowd that
          roars when you catch fire.
        </p>
      </div>

      {/* Mode picker */}
      <div className="anim-rise grid w-full gap-3 sm:grid-cols-3" style={{ animationDelay: "60ms" }}>
        {MODE_ORDER.map((m) => {
          const info = MODES[m];
          const active = mode === m;
          const best = bests[m] ?? 0;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 ${
                active
                  ? "bg-gradient-to-br from-orange-500/25 to-orange-600/5 ring-2 ring-orange-400/80 shadow-[0_10px_40px_-12px_rgba(249,115,22,0.7)]"
                  : "glass hover:ring-1 hover:ring-slate-500/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl anim-float">{info.icon}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest ${
                    active ? "bg-orange-400 text-slate-950" : "bg-slate-700/70 text-slate-300"
                  }`}
                >
                  {info.tag.toUpperCase()}
                </span>
              </div>
              <h3 className="font-display mt-2 text-2xl tracking-wide text-white">{info.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{info.blurb}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
                <span className="text-slate-500">YOUR BEST</span>
                <span className="font-display text-lg tracking-wider text-amber-300">{best}</span>
              </div>
              {active && (
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Difficulty */}
      <div
        className="anim-rise mt-6 flex w-full flex-col gap-3 rounded-2xl glass p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center gap-2">
          {DIFF_ORDER.map((d) => (
            <button
              key={d}
              onClick={() => setDiff(d)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                diff === d
                  ? "bg-slate-100 text-slate-900 shadow-lg"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {DIFFICULTIES[d].name}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 sm:text-right">
          <span className="font-bold text-slate-200">{DIFFICULTIES[diff].name}:</span>{" "}
          {DIFFICULTIES[diff].blurb}
        </p>
      </div>

      {/* Play */}
      <button
        onClick={() => onStart(mode, diff)}
        className="anim-glow anim-rise group relative mt-7 overflow-hidden rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-14 py-4 font-display text-3xl tracking-[0.15em] text-slate-950 transition-transform hover:scale-[1.04] active:scale-95"
        style={{ animationDelay: "180ms" }}
      >
        <span className="relative z-10">PLAY BALL</span>
        <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
      </button>

      {/* Controls */}
      <div
        className="anim-rise mt-8 grid w-full max-w-3xl gap-3 text-center text-[11px] text-slate-500 sm:grid-cols-3"
        style={{ animationDelay: "240ms" }}
      >
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="mb-1 font-display text-base tracking-widest text-slate-300">MOUSE / TOUCH</div>
          Press &amp; drag away from the hoop, then release — like a slingshot.
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="mb-1 font-display text-base tracking-widest text-slate-300">KEYBOARD</div>
          ← → angle · ↑ ↓ power · SPACE shoot · SHIFT fine tune
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="mb-1 font-display text-base tracking-widest text-slate-300">SCORING</div>
          2 pts inside the arc, 3 pts deep, +1 for a clean swish. Streaks multiply.
        </div>
      </div>

      <button
        onClick={onToggleSound}
        className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-100"
      >
        {soundOn ? "🔊" : "🔇"} SOUND {soundOn ? "ON" : "OFF"}
      </button>
    </div>
  );
}
