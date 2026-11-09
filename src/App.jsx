/**
 * Aplicatia Sudoku 1000.
 * Ecrane: selectarea nivelului (Home), lista unui nivel (LevelScreen),
 * jocul propriu-zis (GameScreen), provocarea zilei si jocul bonus Turing Test.
 * Progresul si statisticile se salveaza local (offline-first) si, daca
 * utilizatorul e autentificat, se sincronizeaza in fundal cu backend-ul.
 *
 * Navigarea foloseste rute pe hash (src/lib/router.js): fiecare ecran are
 * propriul URL, butoanele Back/Forward functioneaza si se pot da linkuri directe.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import puzzles from "./data/puzzles.json";
import Home from "./components/Home.jsx";
import LevelScreen from "./components/LevelScreen.jsx";
import GameScreen from "./components/GameScreen.jsx";
import TuringTestGame from "./components/TuringTestGame.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import AuthModal from "./components/AuthModal.jsx";
import AccountModal from "./components/AccountModal.jsx";
import Nav from "./components/Nav.jsx";
import AchievementsPage from "./components/AchievementsPage.jsx";
import LeaderboardPage from "./components/LeaderboardPage.jsx";
import AchievementToasts from "./components/AchievementToast.jsx";
import api, { initToken } from "./lib/api.js";
import { DIFFICULTIES } from "./lib/sudoku.js";
import { getDailyPuzzle, loadDailyState, recordDailySolved } from "./lib/daily.js";
import { loadTheme } from "./lib/theme.js";
import { setSoundMuted } from "./lib/sound.js";
import { levelForXp } from "./lib/xp.js";
import { ROUTES, useRouter } from "./lib/router.js";
import { loadSettings, saveSetting } from "./storage/settings.js";
import {
  awardSolve,
  adoptServerProfile,
  loadProfile,
  buildLocalContext,
} from "./storage/profile.js";
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
  // Ecranul curent vine din URL (#/...), nu dintr-o stare interna.
  const { route, navigate, goBack } = useRouter();
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

  // gamification: profil XP + realizari + notificari animate
  const [profile, setProfile] = useState(null);
  const [localContext, setLocalContext] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastKey = useRef(0);

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

      // profil gamification local (functioneaza si fara cont)
      const localProfile = await loadProfile();
      setProfile(localProfile);
      setLocalContext(await buildLocalContext(localProfile));

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
      const daily = await loadDailyState();

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

      const merged = await api.syncProgress(entries, localStats, daily);

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

      // Profilul serverului e autoritar: XP + realizari deblocate acolo.
      if (merged.profile) {
        const adopted = await adoptServerProfile(merged.profile);
        setProfile(adopted);
        setLocalContext(await buildLocalContext(adopted));
        pushToastsFor(merged.newlyUnlocked || []);
      }
    } catch {
      // Offline sau server indisponibil: nu deranjam utilizatorul.
    } finally {
      setSyncing(false);
    }
  }, []);

  // ---------- navigare (rute) ----------
  const activePuzzle = useMemo(
    () =>
      route.name === "puzzle"
        ? puzzles.find((puzzle) => puzzle.id === route.params.id) ?? null
        : null,
    [route]
  );

  const activeLevel =
    route.name === "level" && DIFFICULTIES[route.params.level] ? route.params.level : null;

  // Rute invalide (necunoscute, nivel sau puzzle inexistent) -> acasa,
  // inlocuind intrarea din istoric (Back nu duce iar pe ruta stricata).
  const invalidRoute =
    route.name === "notFound" ||
    (route.name === "level" && !activeLevel) ||
    (route.name === "puzzle" && !activePuzzle);

  useEffect(() => {
    if (invalidRoute) navigate(ROUTES.home(), { replace: true });
  }, [invalidRoute, navigate]);

  // Puzzle deschis (din aplicatie SAU prin link direct) = „ultimul jucat".
  useEffect(() => {
    if (!activePuzzle) return;
    setLast(activePuzzle.id);
    setLastPlayed(activePuzzle.id);
  }, [activePuzzle]);

  // La iesirea dintr-un joc (orice ruta in afara de joc) reincarcam progresul,
  // inclusiv cand utilizatorul foloseste butonul Back al browserului.
  const inGame = route.name === "puzzle" || route.name === "daily";
  useEffect(() => {
    if (!ready || inGame) return;
    loadAllProgress().then(setProgress);
  }, [ready, inGame]);

  // Titlul tab-ului reflecta ecranul curent.
  useEffect(() => {
    const titles = {
      level: activeLevel && `${DIFFICULTIES[activeLevel].label}`,
      puzzle: activePuzzle && `Puzzle #${activePuzzle.id}`,
      daily: "Provocarea zilei",
      achievements: "Realizări",
      leaderboard: "Clasament",
      turing: "Turing Test",
    };
    const title = titles[route.name];
    document.title = title ? `${title} · Sudoku 1000` : "Sudoku 1000";
  }, [route.name, activeLevel, activePuzzle]);

  /** Navigatia din bara de sus: "home" | "achievements" | "leaderboard". */
  const navigateTo = useCallback(
    (name) => navigate((ROUTES[name] ?? ROUTES.home)()),
    [navigate]
  );

  /** Deschide lista de puzzle-uri a unui nivel. */
  const openLevel = useCallback((level) => navigate(ROUTES.level(level)), [navigate]);

  /** Deschide un puzzle (efectul de mai sus il retine ca „ultimul jucat"). */
  const openPuzzle = useCallback((id) => navigate(ROUTES.puzzle(id)), [navigate]);

  /** Din joc inapoi la lista nivelului puzzle-ului. */
  const exitGame = useCallback(() => {
    goBack(activePuzzle ? ROUTES.level(activePuzzle.difficulty) : ROUTES.home());
  }, [goBack, activePuzzle]);

  const goHome = useCallback(() => goBack(ROUTES.home()), [goBack]);

  // ---------- gamification: notificari ----------
  const pushToast = useCallback((toast) => {
    toastKey.current += 1;
    setToasts((prev) => [...prev, { ...toast, key: `t${toastKey.current}` }]);
  }, []);

  const dismissToast = useCallback((key) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
  }, []);

  const pushToastsFor = useCallback(
    (achievementIds) => {
      for (const id of achievementIds || []) pushToast({ type: "achievement", id });
    },
    [pushToast]
  );

  // ---------- rezolvare ----------
  /** La rezolvare: statistici + XP + realizari, o singura data per puzzle. */
  const handleSolved = useCallback(
    async (puzzle, seconds, extra = {}) => {
      const fresh = await recordSolved(puzzle.difficulty, seconds);
      setStats(fresh);
      const all = await loadAllProgress();
      setProgress(all);

      // XP + realizari locale (offline-first). Serverul recalculeaza
      // autoritar la sync; local, XP-ul e acordat o singura data per puzzle.
      const award = await awardSolve({
        puzzleId: puzzle.id,
        difficulty: puzzle.difficulty,
        seconds,
        mistakes: extra.mistakes ?? 0,
        hintsUsed: extra.hintsUsed ?? 0,
      });
      setProfile(award.profile);
      setLocalContext(await buildLocalContext(award.profile));
      pushToastsFor(award.newlyUnlocked);
      if (award.levelUp) {
        pushToast({ type: "level", level: levelForXp(award.profile.xp) });
      }

      // Sincronizare in fundal daca e autentificat (silentios, fara blocare UI).
      if (api.getToken()) syncNow();
    },
    [syncNow, pushToastsFor, pushToast]
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
      "Sigur vrei sa stergi tot progresul, XP-ul si realizarile? Actiunea nu poate fi anulata."
    );
    if (!confirmed) return;

    await resetEverything();
    if (api.getToken()) {
      await api.resetServerProgress().catch(() => {});
    }
    setProgress({});
    setStats({ solved: 0, totalSeconds: 0, bestTimes: {} });
    setLast(null);
    setProfile(await loadProfile());
    setLocalContext(await buildLocalContext(await loadProfile()));
    navigate(ROUTES.home(), { replace: true });
  }, [navigate]);

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
  if (!ready || invalidRoute) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-muted">Se incarca progresul...</p>
      </div>
    );
  }

  if (route.name === "turing") {
    return <TuringTestGame onExit={goHome} />;
  }

  // Modalele (setari, cont) — comune paginilor cu bara de navigare.
  const modals = (
    <>
      <AchievementToasts toasts={toasts} onDismiss={dismissToast} />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAuth && !user && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuthenticated={async (authenticatedUser) => {
            setUser(authenticatedUser);
            setShowAuth(false);
            await syncNow();
          }}
        />
      )}

      {showAuth && user && (
        <AccountModal
          user={user}
          onClose={() => setShowAuth(false)}
          onUpdated={setUser}
          onLoggedOut={() => {
            api.logout();
            setUser(null);
            setShowAuth(false);
          }}
          onDeleted={() => {
            setUser(null);
            setShowAuth(false);
          }}
        />
      )}
    </>
  );

  const nav = (active) => (
    <Nav
      active={active}
      profile={profile}
      user={user}
      syncing={syncing}
      onNavigate={navigateTo}
      onOpenSettings={() => setShowSettings(true)}
      onOpenAuth={() => setShowAuth(true)}
    />
  );

  // ---------- pagini de gamification (cu navigatia partajata) ----------
  if (route.name === "achievements" || route.name === "leaderboard") {
    return (
      <>
        {nav(route.name)}
        {route.name === "achievements" ? (
          <AchievementsPage
            profile={profile}
            localContext={localContext}
            user={user}
            onSynced={(data) => pushToastsFor(data?.newlyUnlocked)}
          />
        ) : (
          <LeaderboardPage user={user} onOpenAuth={() => setShowAuth(true)} />
        )}
        {modals}
      </>
    );
  }

  if (route.name === "level" && activeLevel) {
    return (
      <LevelScreen
        level={activeLevel}
        puzzles={puzzles}
        progress={progress}
        onBack={goHome}
        onOpen={openPuzzle}
      />
    );
  }

  if (route.name === "puzzle" && activePuzzle) {
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

  if (route.name === "daily" && dailyInfo.puzzle) {
    return (
      <GameScreen
        key={`daily-${dailyInfo.date}`}
        puzzle={dailyInfo.puzzle}
        mistakesLimit={settings.mistakesLimit}
        isDaily
        onExit={goHome}
        onSolved={handleDailySolved}
      />
    );
  }

  return (
    <>
      {nav("home")}

      <Home
        puzzles={puzzles}
        progress={progress}
        stats={stats}
        lastPlayed={lastPlayed}
        daily={dailyInfo}
        profile={profile}
        onOpenLevel={openLevel}
        onContinue={() => lastPlayed && openPuzzle(lastPlayed)}
        onOpenTuring={() => navigate(ROUTES.turing())}
        onOpenDaily={() => navigate(ROUTES.daily())}
        onReset={handleReset}
      />

      {modals}
    </>
  );
}
