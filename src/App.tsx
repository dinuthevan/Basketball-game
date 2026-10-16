import { useCallback, useEffect, useState } from "react";
import Menu from "./components/Menu";
import GameScreen from "./components/GameScreen";
import Results from "./components/Results";
import type { Difficulty, Mode, Summary } from "./game/engine";
import { bestKey, type BestRecord } from "./types";
import { sfx } from "./game/audio";

type Screen = "menu" | "play" | "results";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("time");
  const [difficulty, setDifficulty] = useState<Difficulty>("pro");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [runId, setRunId] = useState(0);
  const [bests, setBests] = useState<Record<Mode, number>>({
    time: 0,
    free: 0,
    streak: 0,
  });

  // load best scores
  useEffect(() => {
    try {
      const next: Record<Mode, number> = { time: 0, free: 0, streak: 0 };
      (Object.keys(next) as Mode[]).forEach((m) => {
        for (const d of ["rookie", "pro", "legend"] as Difficulty[]) {
          const raw = localStorage.getItem(bestKey(m, d));
          if (raw) {
            const rec = JSON.parse(raw) as BestRecord;
            if (typeof rec.score === "number") next[m] = Math.max(next[m], rec.score);
          }
        }
      });
      setBests(next);
    } catch {
      /* ignore */
    }
  }, [screen]);

  useEffect(() => {
    sfx.setEnabled(soundOn);
  }, [soundOn]);

  const start = useCallback((m: Mode, d: Difficulty) => {
    sfx.resume();
    sfx.play("click");
    setMode(m);
    setDifficulty(d);
    setSummary(null);
    setIsRecord(false);
    setRunId((r) => r + 1);
    setScreen("play");
  }, []);

  const handleOver = useCallback(
    (s: Summary) => {
      let record = false;
      try {
        const key = bestKey(s.mode, s.difficulty);
        const raw = localStorage.getItem(key);
        const prev = raw ? (JSON.parse(raw) as BestRecord) : null;
        if (!prev || s.score > prev.score) {
          const rec: BestRecord = {
            score: s.score,
            difficulty: s.difficulty,
            accuracy: s.accuracy,
          };
          localStorage.setItem(key, JSON.stringify(rec));
          record = s.score > 0;
        }
      } catch {
        /* ignore */
      }
      setIsRecord(record);
      setSummary(s);
      setScreen("results");
    },
    [],
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-court-900 no-select">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(249,115,22,0.16),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.12),transparent_50%),radial-gradient(circle_at_50%_120%,rgba(139,92,246,0.14),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)",
          }}
        />
      </div>

      {screen === "menu" && (
        <Menu
          bests={bests}
          soundOn={soundOn}
          onToggleSound={() => {
            const next = !soundOn;
            sfx.setEnabled(next);
            if (next) sfx.play("click");
            setSoundOn(next);
          }}
          onStart={start}
        />
      )}

      {screen === "play" && (
        <GameScreen
          key={`${mode}-${difficulty}-${runId}`}
          mode={mode}
          difficulty={difficulty}
          onExit={() => setScreen("menu")}
          onGameOver={handleOver}
        />
      )}

      {screen === "results" && summary && (
        <Results
          summary={summary}
          isRecord={isRecord}
          onRetry={() => start(summary.mode, summary.difficulty)}
          onMenu={() => setScreen("menu")}
        />
      )}
    </div>
  );
}
