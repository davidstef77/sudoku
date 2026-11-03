/**
 * Aplicatia Sudoku 1000.
 * Doua ecrane: lista de puzzle-uri (Home) si jocul propriu-zis (GameScreen).
 * Progresul si statisticile se salveaza in AsyncStorage (localStorage pe web).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import puzzles from "./data/puzzles.json";
import Home from "./components/Home.jsx";
import GameScreen from "./components/GameScreen.jsx";
import {
  getLastPlayed,
  loadAllProgress,
  loadStats,
  recordSolved,
  resetEverything,
  setLastPlayed,
} from "./storage/progress.js";

export default function App() {
  const [activeId, setActiveId] = useState(null);
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

  /** Deschide un puzzle si il retine ca „ultimul jucat". */
  const openPuzzle = useCallback(async (id) => {
    setActiveId(id);
    setLast(id);
    await setLastPlayed(id);
  }, []);

  /** Reincarca progresul cand ne intoarcem la lista. */
  const exitGame = useCallback(async () => {
    setActiveId(null);
    const all = await loadAllProgress();
    setProgress(all);
  }, []);

  /** La rezolvare: actualizam statisticile o singura data. */
  const handleSolved = useCallback(
    async (puzzle, seconds) => {
      const fresh = await recordSolved(puzzle.difficulty, seconds);
      setStats(fresh);
      const all = await loadAllProgress();
      setProgress(all);
    },
    []
  );

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
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-muted">Se incarca progresul...</p>
      </div>
    );
  }

  if (activePuzzle) {
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
      onOpen={openPuzzle}
      onContinue={() => lastPlayed && openPuzzle(lastPlayed)}
      onReset={handleReset}
    />
  );
}
