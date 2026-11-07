/**
 * Aplicatia Sudoku 1000.
 * Ecrane: selectarea nivelului (Home), lista unui nivel (LevelScreen),
 * jocul propriu-zis (GameScreen) si jocul bonus Turing Test.
 * Progresul si statisticile se salveaza in AsyncStorage (localStorage pe web).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import puzzles from "./data/puzzles.json";
import Home from "./components/Home.jsx";
import LevelScreen from "./components/LevelScreen.jsx";
import GameScreen from "./components/GameScreen.jsx";
import TuringTestGame from "./components/TuringTestGame.jsx";
import {
  getLastPlayed,
  loadAllProgress,
  loadStats,
  recordSolved,
  resetEverything,
  setLastPlayed,
} from "./storage/progress.js";

export default function App() {
  // "home" = nivelurile, "level" = lista unui nivel, "sudoku" = jocul, "turing" = bonus.
  const [view, setView] = useState("home");
  const [activeId, setActiveId] = useState(null);
  const [activeLevel, setActiveLevel] = useState(null);
  const [progress, setProgress] = useState({});
  const [stats, setStats] = useState({ solved: 0, totalSeconds: 0, bestTimes: {} });
  const [lastPlayed, setLast] = useState(null);
  const [ready, setReady] = useState(false);

  // Incarcam tot la prima randare.
  useEffect(() => {
    let active = true;

    (async () => {
      const [allProgress, loadedStats, last] = await Promise.all([
        loadAllProgress(),
        loadStats(),
        getLastPlayed(),
      ]);

      if (!active) return;
      setProgress(allProgress);
      setStats(loadedStats);
      setLast(last);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  const activePuzzle = useMemo(
    () => puzzles.find((puzzle) => puzzle.id === activeId) ?? null,
    [activeId]
  );

  /** Deschide lista de puzzle-uri a unui nivel. */
  const openLevel = useCallback((level) => {
    setActiveLevel(level);
    setView("level");
  }, []);

  /** Deschide un puzzle si il retine ca „ultimul jucat". */
  const openPuzzle = useCallback(async (id) => {
    const puzzle = puzzles.find((entry) => entry.id === id);
    setActiveId(id);
    setActiveLevel(puzzle?.difficulty ?? null);
    setView("sudoku");
    setLast(id);
    await setLastPlayed(id);
  }, []);

  /** Reincarca progresul cand ne intoarcem la lista nivelului. */
  const exitGame = useCallback(async () => {
    setActiveId(null);
    setView(activeLevel ? "level" : "home");
    const all = await loadAllProgress();
    setProgress(all);
  }, [activeLevel]);

  /** La rezolvare: actualizam statisticile o singura data. */
  const handleSolved = useCallback(async (puzzle, seconds) => {
    const fresh = await recordSolved(puzzle.difficulty, seconds);
    setStats(fresh);
    const all = await loadAllProgress();
    setProgress(all);
  }, []);

  /** Sterge tot progresul (cu confirmare). */
  const handleReset = useCallback(async () => {
    const confirmed = window.confirm(
      "Sigur vrei sa stergi tot progresul si statisticile? Actiunea nu poate fi anulata."
    );
    if (!confirmed) return;

    await resetEverything();
    setProgress({});
    setStats({ solved: 0, totalSeconds: 0, bestTimes: {} });
    setLast(null);
    setActiveId(null);
    setActiveLevel(null);
    setView("home");
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-muted">Se incarca progresul...</p>
      </div>
    );
  }

  if (view === "turing") {
    return <TuringTestGame onExit={() => setView("home")} />;
  }

  if (view === "level" && activeLevel) {
    return (
      <LevelScreen
        level={activeLevel}
        puzzles={puzzles}
        progress={progress}
        onBack={() => {
          setActiveLevel(null);
          setView("home");
        }}
        onOpen={openPuzzle}
      />
    );
  }

  if (view === "sudoku" && activePuzzle) {
    return (
      <GameScreen
        key={activePuzzle.id}
        puzzle={activePuzzle}
        onExit={exitGame}
        onSolved={handleSolved}
      />
    );
  }

  return (
    <Home
      puzzles={puzzles}
      progress={progress}
      stats={stats}
      lastPlayed={lastPlayed}
      onOpenLevel={openLevel}
      onContinue={() => lastPlayed && openPuzzle(lastPlayed)}
      onOpenTuring={() => setView("turing")}
      onReset={handleReset}
    />
  );
}
