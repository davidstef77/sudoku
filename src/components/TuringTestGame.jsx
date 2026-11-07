/**
 * Turing Test pentru Roboti — joc tip Mastermind cu 4 culori.
 * Calculatorul alege un cod secret de 4 culori (cu repetitii permise),
 * iar jucatorul are 10 incercari. Robotul da indicii textuale vagi.
 */

import { useState } from "react";

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 10;

const COLORS = [
  { key: "rosu", label: "Rosu", hex: "#ef4444" },
  { key: "albastru", label: "Albastru", hex: "#3b82f6" },
  { key: "verde", label: "Verde", hex: "#22c55e" },
  { key: "galben", label: "Galben", hex: "#eab308" },
  { key: "violet", label: "Violet", hex: "#a855f7" },
  { key: "portocaliu", label: "Portocaliu", hex: "#f97316" },
];

const COLOR_BY_KEY = Object.fromEntries(COLORS.map((color) => [color.key, color]));

const MESSAGES = {
  exact: "Robotul observă: Ai cel puțin o culoare corectă la locul corect.",
  present: "Robotul observă: O culoare este prezentă, dar nu unde o cauți.",
  none: "Robotul observă: Niciuna dintre culorile alese nu există în cod.",
  duplicate:
    "Robotul observă: Ai folosit o culoare de două ori. Robotul nu este impresionat.",
  fallback: "Robotul observă: Semnal neclar. Încearcă altă combinație.",
};

/** Cod secret aleatoriu de 4 culori (cu repetitii permise). */
function makeSecret() {
  return Array.from(
    { length: CODE_LENGTH },
    () => COLORS[Math.floor(Math.random() * COLORS.length)].key
  );
}

/** Numarul de potriviri exacte si de culori prezente pe alta pozitie. */
function evaluateGuess(guess, secret) {
  const secretUsed = new Array(CODE_LENGTH).fill(false);
  const guessUsed = new Array(CODE_LENGTH).fill(false);
  let exact = 0;
  let present = 0;

  // Intai potrivirile exacte, ca sa nu fie numarate de doua ori.
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      exact += 1;
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Apoi culorile care exista, dar pe alta pozitie.
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < CODE_LENGTH; j++) {
      if (!secretUsed[j] && guess[i] === secret[j]) {
        present += 1;
        secretUsed[j] = true;
        break;
      }
    }
  }

  return { exact, present };
}

/** Alege aleatoriu un mesaj dintre regulile care se aplica incercarii. */
function robotFeedback(guess, secret) {
  const { exact, present } = evaluateGuess(guess, secret);

  const counts = {};
  for (const key of guess) counts[key] = (counts[key] ?? 0) + 1;
  const hasDuplicate = Object.values(counts).some((count) => count > 1);

  const options = [];
  if (exact > 0) options.push(MESSAGES.exact);
  if (present > 0) options.push(MESSAGES.present);
  if (exact === 0 && present === 0) options.push(MESSAGES.none);
  if (hasDuplicate) options.push(MESSAGES.duplicate);

  if (options.length === 0) return MESSAGES.fallback;
  return options[Math.floor(Math.random() * options.length)];
}

export default function TuringTestGame({ onExit }) {
  const [secret, setSecret] = useState(makeSecret);
  const [slots, setSlots] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("playing"); // playing | won | lost
  const [error, setError] = useState("");

  const attemptsLeft = MAX_ATTEMPTS - history.length;

  function addColor(key) {
    if (status !== "playing" || slots.length >= CODE_LENGTH) return;
    setSlots((current) => [...current, key]);
    setError("");
  }

  function removeLast() {
    if (status !== "playing") return;
    setSlots((current) => current.slice(0, -1));
    setError("");
  }

  function submitGuess() {
    if (status !== "playing") return;

    if (slots.length < CODE_LENGTH) {
      setError("Completează toate cele 4 poziții.");
      return;
    }

    const guess = [...slots];
    const won = guess.every((key, index) => key === secret[index]);
    const feedback = won
      ? "Robotul observă: Cod acceptat. Acces permis."
      : robotFeedback(guess, secret);

    const nextHistory = [...history, { guess, feedback }];
    setHistory(nextHistory);
    setSlots([]);
    setError("");

    if (won) {
      setStatus("won");
    } else if (nextHistory.length >= MAX_ATTEMPTS) {
      setStatus("lost");
    }
  }

  function resetGame() {
    setSecret(makeSecret());
    setSlots([]);
    setHistory([]);
    setStatus("playing");
    setError("");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      {/* ---------- bara de sus ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onExit} className="btn-sm">
          ← Meniu
        </button>

        <div className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-widest text-muted">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "lost"
                ? "bg-rose"
                : status === "won"
                ? "bg-good"
                : "animate-pulse bg-good"
            }`}
          />
          robot online
        </div>
      </header>

      {/* ---------- panoul jocului ---------- */}
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 bg-black/40 px-4 py-4 sm:px-6">
          <h1 className="font-mono text-xl font-bold tracking-tight text-gray-50 sm:text-2xl">
            Turing Test pentru Roboți
          </h1>
          <p className="mt-1 font-mono text-xs leading-relaxed text-muted">
            Ghiceste codul secret de 4 culori. Ai {MAX_ATTEMPTS} încercări.
            Robotul răspunde, dar nu spune niciodată tot adevărul.
          </p>
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
          {/* incercari ramase */}
          <div className="flex items-center justify-between font-mono text-[0.7rem] text-muted">
            <span>
              Încercarea {Math.min(history.length + 1, MAX_ATTEMPTS)} / {MAX_ATTEMPTS}
            </span>
            <span>{attemptsLeft} rămase</span>
          </div>

          {/* cele 4 sloturi */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: CODE_LENGTH }, (_, index) => {
              const key = slots[index];
              const color = key ? COLOR_BY_KEY[key] : null;

              return (
                <div
                  key={index}
                  className="flex aspect-square items-center justify-center rounded-xl border-2 transition-colors"
                  style={
                    color
                      ? {
                          backgroundColor: color.hex,
                          borderColor: "rgba(255,255,255,0.35)",
                          boxShadow: `0 0 18px ${color.hex}66`,
                        }
                      : {
                          borderStyle: "dashed",
                          borderColor: "rgba(255,255,255,0.15)",
                        }
                  }
                  aria-label={
                    color ? color.label : `Poziția ${index + 1} goală`
                  }
                >
                  {!color && (
                    <span className="font-mono text-2xl text-white/15">
                      {index + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* butoanele colorate */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {COLORS.map((color) => (
              <button
                key={color.key}
                type="button"
                onClick={() => addColor(color.key)}
                disabled={status !== "playing" || slots.length >= CODE_LENGTH}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-panel p-2 transition hover:border-white/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className="h-8 w-full rounded-md"
                  style={{
                    backgroundColor: color.hex,
                    boxShadow: `0 0 12px ${color.hex}55`,
                  }}
                />
                <span className="font-mono text-[0.6rem] text-gray-300">
                  {color.label}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="font-mono text-xs text-rose">{error}</p>}

          {/* actiuni */}
          <div className="flex gap-2">
            <button
              onClick={removeLast}
              disabled={status !== "playing" || slots.length === 0}
              className="btn-ghost flex-1 font-mono text-xs"
            >
              Șterge ultima
            </button>
            <button
              onClick={submitGuess}
              disabled={status !== "playing"}
              className="btn-primary flex-1 font-mono text-xs"
            >
              Trimite Ghiceala
            </button>
          </div>

          {/* ultimul feedback */}
          {history.length > 0 && status === "playing" && (
            <div className="rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed text-gray-200">
              <span className="text-good">ROBOT&gt;</span>{" "}
              {history[history.length - 1].feedback}
            </div>
          )}

          {/* final: castig */}
          {status === "won" && (
            <div className="rounded-xl border border-good/40 bg-good/10 p-4 text-center">
              <p className="font-mono text-2xl font-bold text-good">
                ACCES PERMIS
              </p>
              <p className="mt-1 font-mono text-xs text-gray-300">
                Ai ghicit codul în {history.length} încercări.
              </p>
              <div className="mt-3 flex justify-center gap-1.5">
                {secret.map((key, index) => (
                  <span
                    key={index}
                    className="h-7 w-7 rounded-md border border-white/30"
                    style={{ backgroundColor: COLOR_BY_KEY[key].hex }}
                  />
                ))}
              </div>
              <button
                onClick={resetGame}
                className="btn-primary mt-4 w-full font-mono text-xs"
              >
                Joacă din nou
              </button>
            </div>
          )}

          {/* final: pierdut */}
          {status === "lost" && (
            <div className="rounded-xl border border-rose/40 bg-rose/10 p-4 text-center">
              <p className="font-mono text-2xl font-bold text-rose">
                ACCES REFUZAT
              </p>
              <p className="mt-1 font-mono text-xs text-gray-300">
                Ai epuizat cele {MAX_ATTEMPTS} încercări. Codul secret era:
              </p>
              <div className="mt-3 flex justify-center gap-1.5">
                {secret.map((key, index) => (
                  <span
                    key={index}
                    className="h-7 w-7 rounded-md border border-white/30"
                    style={{ backgroundColor: COLOR_BY_KEY[key].hex }}
                  />
                ))}
              </div>
              <button
                onClick={resetGame}
                className="btn-primary mt-4 w-full font-mono text-xs"
              >
                Încearcă din nou
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------- istoric ---------- */}
      <section>
        <h2 className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted">
          Istoric încercări
        </h2>

        {history.length === 0 ? (
          <p className="font-mono text-xs text-muted/70">
            Nicio încercare încă. Alege 4 culori și trimite ghicirea.
          </p>
        ) : (
          <ol className="space-y-2">
            {history.map((entry, index) => (
              <li
                key={index}
                className="rounded-xl border border-white/10 bg-panel/80 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.65rem] text-muted">
                    #{index + 1}
                  </span>
                  <div className="flex gap-1.5">
                    {entry.guess.map((key, slot) => (
                      <span
                        key={slot}
                        className="h-5 w-5 rounded border border-white/20"
                        style={{ backgroundColor: COLOR_BY_KEY[key].hex }}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-2 font-mono text-[0.7rem] leading-relaxed text-gray-300">
                  <span className="text-good">ROBOT&gt;</span> {entry.feedback}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
