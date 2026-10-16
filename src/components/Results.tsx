import { DIFFICULTIES, MODES } from "../game/engine";
import type { Summary } from "../game/engine";

interface Props {
  summary: Summary;
  isRecord: boolean;
  onRetry: () => void;
  onMenu: () => void;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center">
      <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">{label}</div>
      <div className={`font-display mt-1 text-4xl tracking-wider ${accent ?? "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

export default function Results({ summary, isRecord, onRetry, onMenu }: Props) {
  const grade = (() => {
    const a = summary.accuracy;
    const s = summary.score;
    if (summary.mode === "streak") {
      if (summary.bestStreak >= 15) return { t: "HALL OF FAMER", e: "🏆" };
      if (summary.bestStreak >= 10) return { t: "CLUTCH", e: "🔥" };
      if (summary.bestStreak >= 6) return { t: "SHARP SHOOTER", e: "🎯" };
      if (summary.bestStreak >= 3) return { t: "GETTING WARM", e: "😅" };
      return { t: "COLD NIGHT", e: "🥶" };
    }
    if (a >= 90 && s > 40) return { t: "HALL OF FAMER", e: "🏆" };
    if (a >= 70) return { t: "SHARP SHOOTER", e: "🎯" };
    if (a >= 50) return { t: "SOLID ROTATION", e: "👍" };
    if (a >= 30) return { t: "SIXTH MAN", e: "😅" };
    return { t: "COLD NIGHT", e: "🥶" };
  })();

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
      <div className="anim-rise w-full rounded-3xl glass p-6 text-center sm:p-9">
        <div className="text-[11px] font-bold tracking-[0.4em] text-slate-500">
          {MODES[summary.mode].name.toUpperCase()} ·{" "}
          {DIFFICULTIES[summary.difficulty].name.toUpperCase()}
        </div>

        <div className="anim-pop my-2 text-6xl anim-float">{grade.e}</div>
        <h2 className="font-display text-5xl tracking-wide text-white hard-shadow sm:text-6xl">
          {grade.t}
        </h2>
        {summary.message && (
          <div className="mt-1 text-sm font-bold tracking-[0.2em] text-amber-300">
            {summary.message}
          </div>
        )}

        {isRecord && (
          <div className="anim-pop mx-auto mt-4 w-fit rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-1.5 font-display text-lg tracking-[0.2em] text-slate-950">
            ★ NEW PERSONAL BEST ★
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-gradient-to-b from-orange-500/15 to-transparent py-6">
          <div className="text-[10px] font-bold tracking-[0.35em] text-slate-400">FINAL SCORE</div>
          <div className="font-display text-8xl leading-none tracking-wider text-amber-300 tabular-nums">
            {summary.score}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="MAKES" value={`${summary.makes}`} accent="text-emerald-300" />
          <Stat label="SHOTS" value={`${summary.shots}`} />
          <Stat label="ACCURACY" value={`${summary.accuracy}%`} accent="text-cyan-300" />
          <Stat label="BEST RUN" value={`${summary.bestStreak}`} accent="text-rose-300" />
        </div>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={onRetry}
            className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-10 py-3 font-display text-2xl tracking-[0.15em] text-slate-950 transition hover:scale-105 active:scale-95"
          >
            RUN IT BACK
          </button>
          <button
            onClick={onMenu}
            className="rounded-full border border-white/15 bg-white/5 px-10 py-3 font-display text-2xl tracking-[0.15em] text-slate-200 transition hover:bg-white/10"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
