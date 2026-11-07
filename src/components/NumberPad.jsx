/**
 * Tastatura numerica + butoane de actiune (notite, sterge, undo, hint).
 * Butoanele au inaltime minima mare, ca sa poata fi atinse usor pe telefon.
 */

import { DIGITS } from "../lib/sudoku.js";

export default function NumberPad({
  values,
  highlightDigit,
  blockedDigits = new Set(),
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

  const hasBlocked = blockedDigits.size > 0;

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 sm:gap-1.5">
        {DIGITS.map((digit) => {
          const exhausted = usage[digit] >= 9;
          const blocked = blockedDigits.has(digit);
          const active = digit === highlightDigit;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              disabled={disabled || blocked}
              aria-pressed={active}
              title={
                blocked
                  ? "Cifra apare deja pe același rând, coloană sau bloc"
                  : undefined
              }
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border font-mono transition sm:min-h-14
                ${
                  active
                    ? "border-white bg-accent text-ink shadow-glow"
                    : blocked
                    ? "border-rose/40 bg-white/[0.02] text-rose/50 line-through opacity-60"
                    : exhausted
                    ? "border-white/5 bg-white/[0.03] text-white/25"
                    : "border-white/10 bg-cell text-white shadow-card hover:border-white/40 hover:bg-cellAlt active:scale-95"
                }
                disabled:cursor-not-allowed`}
            >
              <span className="text-lg font-bold leading-none sm:text-xl">
                {digit}
              </span>
              <span
                className={`text-[0.5rem] leading-none tabular-nums ${
                  active ? "text-ink/60" : "text-muted"
                }`}
              >
                {usage[digit]}/9
              </span>
            </button>
          );
        })}
      </div>

      {hasBlocked && (
        <p className="text-center text-[0.65rem] leading-relaxed text-muted/80">
          Cifrele tăiate contravin regulilor: apar deja pe același rând, coloană
          sau bloc 3×3.
        </p>
      )}

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
            ? "border-white/70 bg-white/15 text-white"
            : "border-white/10 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  );
}
