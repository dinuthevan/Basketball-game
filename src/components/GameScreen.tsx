import { useCallback, useEffect, useRef, useState } from "react";
import {
  BasketballGame,
  DIFFICULTIES,
  MODES,
  type Difficulty,
  type Mode,
  type Stats,
  type Summary,
} from "../game/engine";
import { sfx } from "../game/audio";

interface Props {
  mode: Mode;
  difficulty: Difficulty;
  onExit: () => void;
  onGameOver: (s: Summary) => void;
}

function fmtTime(t: number) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function GameScreen({ mode, difficulty, onExit, onGameOver }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BasketballGame | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paused, setPaused] = useState(false);

  const overTimer = useRef<number | null>(null);
  const handleStats = useCallback((s: Stats) => setStats(s), []);
  const handleOver = useCallback(
    (s: Summary) => {
      overTimer.current = window.setTimeout(() => {
        overTimer.current = null;
        onGameOver(s);
      }, 950);
    },
    [onGameOver],
  );

  useEffect(
    () => () => {
      if (overTimer.current) window.clearTimeout(overTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new BasketballGame(canvasRef.current, { mode, difficulty }, handleStats, handleOver);
    gameRef.current = g;
    const onVis = () => {
      if (document.hidden) {
        g.paused = true;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      g.destroy();
      gameRef.current = null;
    };
  }, [mode, difficulty, handleStats, handleOver]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = paused;
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePause = () => {
    sfx.play("click");
    setPaused((p) => !p);
  };

  const info = MODES[mode];
  const s = stats;
  const acc = s && s.shots > 0 ? Math.round((s.makes / s.shots) * 100) : 0;
  const timeCritical = mode === "time" && (s?.timeLeft ?? 0) <= 10;

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1120px] flex-col justify-center px-2 py-3 sm:px-4 sm:py-5">
      {/* HUD */}
      <div className="mb-2 flex items-stretch gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl glass px-3 py-2 sm:gap-4 sm:px-5 sm:py-3">
          <div className="hidden shrink-0 flex-col leading-none sm:flex">
            <span className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
              {info.name.toUpperCase()}
            </span>
            <span className="font-display text-xl tracking-widest text-slate-200">
              {DIFFICULTIES[difficulty].name.toUpperCase()}
            </span>
          </div>
          <div className="shrink-0 border-white/10 sm:border-l sm:pl-4">
            <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">SCORE</div>
            <div className="font-display text-4xl leading-none tracking-wider text-amber-300 tabular-nums sm:text-5xl">
              {s?.score ?? 0}
            </div>
          </div>
          {s && s.combo > 1 && (
            <div className="anim-pop shrink-0 rounded-xl bg-rose-500/20 px-2 py-1 text-center ring-1 ring-rose-400/50">
              <div className="text-[9px] font-bold tracking-widest text-rose-300">MULTIPLIER</div>
              <div className="font-display text-2xl leading-none text-rose-200">×{s.combo}</div>
            </div>
          )}
          <div className="min-w-0 flex-1 text-right">
            {mode === "time" ? (
              <>
                <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">TIME</div>
                <div
                  className={`font-display text-4xl leading-none tabular-nums sm:text-5xl ${
                    timeCritical ? "animate-pulse text-rose-400" : "text-slate-100"
                  }`}
                >
                  {fmtTime(s?.timeLeft ?? 0)}
                  {timeCritical && (
                    <span className="text-2xl">
                      .{Math.floor(((s?.timeLeft ?? 0) % 1) * 10)}
                    </span>
                  )}
                </div>
              </>
            ) : mode === "free" ? (
              <>
                <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
                  SHOTS LEFT
                </div>
                <div className="font-display text-4xl leading-none text-slate-100 tabular-nums sm:text-5xl">
                  {s?.shotsLeft ?? 10}
                  <span className="text-xl text-slate-500">/10</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">STREAK</div>
                <div
                  className={`font-display text-4xl leading-none tabular-nums sm:text-5xl ${
                    (s?.streak ?? 0) >= 3 ? "anim-flame text-orange-400" : "text-slate-100"
                  }`}
                >
                  {s?.streak ?? 0}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={togglePause}
            className="flex-1 rounded-2xl glass px-3 text-sm font-bold text-slate-300 transition hover:text-white sm:px-4"
          >
            {paused ? "▶" : "❚❚"}
          </button>
          <button
            onClick={() => {
              sfx.play("click");
              onExit();
            }}
            className="flex-1 rounded-2xl glass px-3 text-sm font-bold text-slate-400 transition hover:text-rose-300 sm:px-4"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Court */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-court-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
        style={{ aspectRatio: "8 / 5" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* spot + streak overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-1.5 backdrop-blur">
            <div className="text-[9px] font-bold tracking-[0.25em] text-slate-500">POSITION</div>
            <div className="font-display text-lg leading-none tracking-widest text-cyan-300">
              {s?.spotLabel ?? ""}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-1.5 text-right backdrop-blur">
              <div className="text-[9px] font-bold tracking-[0.25em] text-slate-500">MADE / SHOTS</div>
              <div className="font-display text-lg leading-none tracking-widest text-slate-100">
                {s?.makes ?? 0} <span className="text-slate-500">/ {s?.shots ?? 0}</span>
                <span className="ml-2 text-cyan-300">{acc}%</span>
              </div>
            </div>
            {s && s.streak >= 2 && (
              <div className="flex items-center gap-1 rounded-xl border border-orange-400/40 bg-orange-500/15 px-2 py-1 backdrop-blur">
                {Array.from({ length: Math.min(s.streak, 10) }).map((_, i) => (
                  <span key={i} className="text-xs">
                    🔥
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* message toast */}
        {s?.message && (
          <div className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center">
            <div
              key={s.message}
              className={`anim-pop font-display rounded-2xl px-6 py-2 text-4xl tracking-widest hard-shadow sm:text-5xl ${
                s.lastResult === "miss"
                  ? "text-slate-300"
                  : s.lastResult === "swish"
                    ? "text-amber-300"
                    : "text-orange-300"
              }`}
            >
              {s.message}
            </div>
          </div>
        )}

        {/* pause overlay */}
        {paused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-slate-950/80 backdrop-blur-sm">
            <h2 className="font-display text-6xl tracking-widest text-white">PAUSED</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={togglePause}
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 font-display text-2xl tracking-widest text-slate-950 transition hover:scale-105"
              >
                RESUME
              </button>
              <button
                onClick={onExit}
                className="rounded-full border border-white/15 bg-white/5 px-8 py-3 font-display text-2xl tracking-widest text-slate-200 transition hover:bg-white/10"
              >
                QUIT
              </button>
            </div>
            <p className="text-xs text-slate-500">ESC or P to resume</p>
          </div>
        )}
      </div>

      {/* footer controls hint */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
        <span className="hidden sm:inline">
          <span className="font-bold text-slate-400">AIM</span> drag back &amp; release ·
          <span className="ml-1 font-bold text-slate-400">KEYS</span> ← → ↑ ↓ SPACE
        </span>
        <span className="sm:hidden">
          <span className="font-bold text-slate-400">TAP &amp; DRAG</span> away from the hoop, release to
          shoot
        </span>
        <span className="hidden sm:inline">
          Deep shots = <span className="font-bold text-amber-400">3 PTS</span> · swish ={" "}
          <span className="font-bold text-amber-400">+1</span> · 2 makes in a row start the{" "}
          <span className="font-bold text-rose-400">multiplier</span>
        </span>
        <span className="sm:hidden">
          <span className="font-bold text-amber-400">ESC</span> pause ·{" "}
          <span className="font-bold text-rose-400">streaks</span> multiply your points
        </span>
      </div>
    </div>
  );
}
