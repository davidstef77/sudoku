/**
 * Tastatura numerica + butoane de actiune (notite, sterge, undo, hint).
 * Butoanele au inaltime minima mare, ca sa poata fi atinse usor pe telefon.
 */

import { DIGITS } from "../lib/sudoku.js";

export default function NumberPad({
  values,
  highlightDigit,
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
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 sm:gap-1.5">
        {DIGITS.map((digit) => {
          const exhausted = usage[digit] >= 9;
          const active = digit === highlightDigit;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              disabled={disabled}
              aria-pressed={active}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border font-mono transition sm:min-h-14
                ${
                  active
                    ? "border-highlight/70 bg-highlight/25 text-white shadow-glow ring-1 ring-inset ring-highlight/50"
                    : exhausted
                    ? "border-white/5 bg-white/[0.03] text-muted/40"
                    : "border-white/10 bg-cell text-slate-100 shadow-card hover:border-white/30 hover:bg-cellAlt active:scale-95"
                }
                disabled:cursor-not-allowed`}
            >
              <span className="text-lg font-bold leading-none sm:text-xl">
                {digit}
              </span>
              <span className="text-[0.5rem] leading-none tabular-nums text-muted">
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
      className={`min-h-12 rounded-xl border px-2 py-3 text-xs font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm
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
