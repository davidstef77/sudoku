/**
 * Tastatura numerica + butoane de actiune (notite, sterge, undo, hint).
 * Butoanele au inaltime minima mare, ca sa poata fi atinse usor pe telefon.
 *
 * Fara niciun ajutor vizual: nu mai afisam cate cifre sunt deja pe tabla
 * si nu mai marcam cifrele care ar incalca regulile de rand / coloana / bloc.
 * Jucatorul trebuie sa deduca singur pozitiile corecte.
 */

import { DIGITS } from "../lib/sudoku.js";

export default function NumberPad({
  highlightDigit,
  noteMode,
  onToggleNotes,
  onDigit,
  onErase,
  onUndo,
  onHint,
  disabled,
}) {
  return (
    <div className="w-full max-w-md space-y-3">
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 sm:gap-1.5">
        {DIGITS.map((digit) => {
          const active = digit === highlightDigit;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              disabled={disabled}
              aria-pressed={active}
              className={`flex min-h-12 items-center justify-center rounded-xl border font-mono text-lg font-bold leading-none transition sm:min-h-14 sm:text-xl
                ${
                  active
                    ? "border-white bg-accent text-ink shadow-glow"
                    : "border-white/10 bg-cell text-white shadow-card hover:border-white/40 hover:bg-cellAlt active:scale-95"
                }
                disabled:cursor-not-allowed`}
            >
              {digit}
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
            ? "border-white/70 bg-white/15 text-white"
            : "border-white/10 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  );
}
