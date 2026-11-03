/**
 * Tastatura numerica + butoane de actiune (notite, sterge, undo, hint).
 * Fiecare cifra arata de cate ori a fost deja folosita pe tabla.
 */

import { DIGITS } from "../lib/sudoku.js";

export default function NumberPad({
  values,
  noteMode,
  onToggleNotes,
  onDigit,
  onErase,
  onUndo,
  onHint,
  disabled,
}) {
  // Cate cifre de fiecare fel sunt deja pe tabla.
  const usage = DIGITS.reduce((acc, digit) => {
    acc[digit] = values.filter((value) => value === digit).length;
    return acc;
  }, {});

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="grid grid-cols-9 gap-1.5">
        {DIGITS.map((digit) => {
          const exhausted = usage[digit] >= 9;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              disabled={disabled}
              className={`relative flex aspect-[3/4] items-center justify-center rounded-lg border text-lg font-bold transition
                ${
                  exhausted
                    ? "border-white/5 bg-white/[0.02] text-muted/40"
                    : "border-white/10 bg-cell text-accentSoft hover:border-accent/50 hover:bg-cellAlt active:scale-95"
                }
                disabled:cursor-not-allowed`}
            >
              {digit}
              <span className="absolute bottom-0.5 text-[0.55rem] font-normal text-muted">
                {usage[digit]}/9
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ActionButton active={noteMode} onClick={onToggleNotes} disabled={disabled}>
          Creion {noteMode ? "ON" : "OFF"}
        </ActionButton>
        <ActionButton onClick={onErase} disabled={disabled}>
          Sterge
        </ActionButton>
        <ActionButton onClick={onUndo} disabled={disabled}>
          Undo
        </ActionButton>
        <ActionButton onClick={onHint} disabled={disabled}>
          Hint
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({ children, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40
        ${
          active
            ? "border-accent/60 bg-accent/20 text-accent"
            : "border-white/10 bg-white/5 text-slate-200 hover:border-accent/40 hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  );
}
