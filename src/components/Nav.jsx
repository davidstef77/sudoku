/**
 * Navigatia partajata (Home / Realizari / Clasament).
 * Logo + rang/nivel + butoane de navigare cu iconite Lucide.
 */

import { Trophy, Medal, Home, Settings, User, Sparkles } from "lucide-react";
import { levelProgress, rankForLevel } from "../lib/xp.js";

export default function Nav({
  active = "home",
  profile,
  user,
  syncing,
  onNavigate,
  onOpenSettings,
  onOpenAuth,
}) {
  const level = levelProgress(profile?.xp || 0);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a16]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {/* logo */}
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2 text-left"
          aria-label="Acasă"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accentDeep shadow-glow">
            <Sparkles className="text-white" size={18} />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight">
            Sudoku <span className="text-accent">1000</span>
          </span>
        </button>

        {/* nivel + XP */}
        {profile && (
          <div className="hidden min-w-[150px] flex-col gap-1 sm:flex">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-accent">Nivel {level.level}</span>
              <span className="text-muted">{rankForLevel(level.level)}</span>
              {syncing && <span className="text-[0.6rem] text-muted">↻ sync…</span>}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${level.percent}%` }} />
            </div>
          </div>
        )}

        {/* navigare */}
        <nav className="ml-auto flex items-center gap-1.5">
          <NavButton
            icon={<Home size={15} />}
            label="Acasă"
            active={active === "home"}
            onClick={() => onNavigate("home")}
          />
          <NavButton
            icon={<Trophy size={15} />}
            label="Realizări"
            active={active === "achievements"}
            onClick={() => onNavigate("achievements")}
          />
          <NavButton
            icon={<Medal size={15} />}
            label="Clasament"
            active={active === "leaderboard"}
            onClick={() => onNavigate("leaderboard")}
          />

          <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />

          <button onClick={onOpenSettings} className="btn-sm" aria-label="Setări">
            <Settings size={15} />
          </button>
          <button onClick={onOpenAuth} className="btn-sm" aria-label="Cont">
            <User size={15} />
            <span className="hidden md:inline">
              {user ? user.displayName || user.email?.split("@")[0] : "Cont"}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
        active
          ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/40"
          : "text-muted hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
