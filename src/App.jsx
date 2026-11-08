/**
 * Aplicatia Sudoku 1000.
 * Ecrane: selectarea nivelului (Home), lista unui nivel (LevelScreen),
 * jocul propriu-zis (GameScreen), provocarea zilei si jocul bonus Turing Test.
 * Progresul si statisticile se salveaza local (offline-first) si, daca
 * utilizatorul e autentificat, se sincronizeaza in fundal cu backend-ul.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import puzzles from "./data/puzzles.json";
import Home from "./components/Home.jsx";
import LevelScreen from "./components/LevelScreen.jsx";
import GameScreen from "./components/GameScreen.jsx";
import TuringTestGame from "./components/TuringTestGame.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import AuthModal from "./components/AuthModal.jsx";
import api, { initToken } from "./lib/api.js";
import { DIFFICULTIES } from "./lib/sudoku.js";
import { getDailyPuzzle, loadDailyState, recordDailySolved } from "./lib/daily.js";
import { loadTheme } from "./lib/theme.js";
import { setSoundMuted } from "./lib/sound.js";
import { loadSettings, saveSetting } from "./storage/settings.js";
import {
  getLastPlayed,
  loadAllProgress,
  loadStats,
  recordSolved,
  resetEverything,
  saveProgress,
  setLastPlayed,
} from "./storage/progress.js";

export default function App() {
  // "home" = nivelurile, "level" = lista unui nivel, "sudoku" = jocul,
  // "daily" = provocarea zilei, "turing" = bonus.
  const [view, setView] = useState("home");
  const [activeId, setActiveId] = useState(null);
  const [activeLevel, setActiveLevel] = useState(null);
  const [progress, setProgress] = useState({});
  const [stats, setStats] = useState({ solved: 0, totalSeconds: 0, bestTimes: {} });
  const [lastPlayed, setLast] = useState(null);
  const [ready, setReady] = useState(false);

  // setari, tema, cont
  const [settings, setSettings] = useState({ soundMuted: false, mistakesLimit: 5, theme: "dark" });
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // seria zilnica
  const [dailyState, setDailyState] = useState({ lastCompleted: null, streak: 0 });

  // ---------- incarcare initiala ----------
  useEffect(() => {
    let active = true;

    (async () => {
      const [allProgress, loadedStats, last, loadedSettings, theme, daily, hasToken] =
        await Promise.all([
          loadAllProgress(),
          loadStats(),
          getLastPlayed(),
          loadSettings(),
          loadTheme(),
          loadDailyState(),
          initToken(),
        ]);

      if (!active) return;

      setProgress(allProgress);
      setStats(loadedStats);
      setLast(last);
      setSettings(loadedSettings);
      setDailyState(daily);
      setSoundMuted(loadedSettings.soundMuted);
      // tema este aplicata de loadTheme()

      // Daca avem token, verificam rapid ca e valid si sincronizam.
      if (hasToken) {
        try {
          const me = await api.me();
          if (active) setUser(me);
          await syncNow();
        } catch {
          api.logout(); // token expirat — continuam local
        }
      }

      if (active) setReady(true);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- sincronizare cu backend-ul ----------
  /** Trimite progresul local + statisticile catre server si aplica raspunsul combinat. */
  const syncNow = useCallback(async () => {
    if (!api.getToken()) return;

    setSyncing(true);
    try {
      const all = await loadAllProgress();
      const localStats = await loadStats();

      const entries = Object.values(all).map((entry) => ({
        puzzleId: entry.id,
        difficulty: entry.difficulty,
        values: entry.values,
        notes: entry.notes,
        elapsed: entry.elapsed,
        mistakes: entry.mistakes,
        hintsUsed: entry.hintsUsed,
        correct: entry.correct,
        completed: entry.completed,
        updatedAt: entry.updatedAt,
      }));

      const merged = await api.syncProgress(entries, localStats);

      // Scriem local doar intrarile server mai noi decat cele locale.
      for (const entry of merged.progress) {
        const local = all[entry.puzzleId];
        const serverTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
        const localTime = local?.updatedAt ?? 0;

        if (serverTime > localTime) {
          await saveProgress(entry.puzzleId, { ...entry, id: entry.puzzleId });
        }
      }

      // Statisticile: pastram "cele mai bune" dintre local si server.
      const bestOf = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
      const bestTimes = { ...(localStats.bestTimes || {}) };
      for (const [level, seconds] of Object.entries(merged.stats?.bestTimes || {})) {
        const current = bestTimes[level];
        if (!current || seconds < current) bestTimes[level] = seconds;
      }

      setStats({
        solved: bestOf(localStats.solved, merged.stats?.solved),
        totalSeconds: bestOf(localStats.totalSeconds, merged.stats?.totalSeconds),
        bestTimes,
      });
      setProgress(await loadAllProgress());
    } catch {
      // Offline sau server indisponibil: nu deranjam utilizatorul.
    } finally {
      setSyncing(false);
    }
  }, []);

  // ---------- navigare ----------
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

  // ---------- rezolvare ----------
  /** La rezolvare: actualizam statisticile o singura data. */
  const handleSolved = useCallback(
    async (puzzle, seconds) => {
      const fresh = await recordSolved(puzzle.difficulty, seconds);
      setStats(fresh);
      const all = await loadAllProgress();
      setProgress(all);

      // Sincronizare in fundal daca e autentificat (silentios, fara blocare UI).
      if (api.getToken()) syncNow();
    },
    [syncNow]
  );

  /** Provocarea zilei rezolvata: actualizam seria + statisticile. */
  const handleDailySolved = useCallback(
    async (puzzle, seconds) => {
      const current = await loadDailyState();
      const next = await recordDailySolved(current);
      setDailyState(next);
      await handleSolved(puzzle, seconds);
    },
    [handleSolved]
  );

  // ---------- setari ----------
  const handleSettingChange = useCallback(async (key, value) => {
    if (key === "soundMuted") setSoundMuted(value);
    setSettings((prev) => ({ ...prev, [key]: value }));
    await saveSetting(key, value);
  }, []);

  // ---------- resetare ----------
  const handleReset = useCallback(async () => {
    const confirmed = window.confirm(
      "Sigur vrei sa stergi tot progresul si statisticile? Actiunea nu poate fi anulata."
    );
    if (!confirmed) return;

    await resetEverything();
    if (api.getToken()) {
      await api.resetServerProgress().catch(() => {});
    }
    setProgress({});
    setStats({ solved: 0, totalSeconds: 0, bestTimes: {} });
    setLast(null);
    setActiveId(null);
    setActiveLevel(null);
    setView("home");
  }, []);

  // ---------- datele provocarii zilei ----------
  const dailyInfo = useMemo(() => {
    const info = getDailyPuzzle(puzzles);
    return {
      ...info,
      difficultyLabel: DIFFICULTIES[info.difficulty].label,
      streak: dailyState.streak,
      solvedToday: dailyState.lastCompleted === info.date,
    };
  }, [puzzles, dailyState]);

  // ---------- randare ----------
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
        mistakesLimit={settings.mistakesLimit}
        onExit={exitGame}
        onSolved={handleSolved}
      />
    );
  }

  if (view === "daily" && dailyInfo.puzzle) {
    return (
      <GameScreen
        key={`daily-${dailyInfo.date}`}
        puzzle={dailyInfo.puzzle}
        mistakesLimit={settings.mistakesLimit}
        isDaily
        onExit={() => setView("home")}
        onSolved={handleDailySolved}
      />
    );
  }

  return (
    <>
      <Home
        puzzles={puzzles}
        progress={progress}
        stats={stats}
        lastPlayed={lastPlayed}
        daily={dailyInfo}
        user={user}
        syncing={syncing}
        onOpenLevel={openLevel}
        onContinue={() => lastPlayed && openPuzzle(lastPlayed)}
        onOpenTuring={() => setView("turing")}
        onOpenDaily={() => setView("daily")}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuth={() => setShowAuth(true)}
        onReset={handleReset}
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuthenticated={async (authenticatedUser) => {
            setUser(authenticatedUser);
            setShowAuth(false);
            await syncNow();
          }}
        />
      )}
    </>
  );
}
