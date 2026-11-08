/**
 * Panoul de setari: sunet, limita de greseli, tema.
 * Modal simplu, inchis cu X sau click pe fundal.
 */

import { saveSetting } from "../storage/settings.js";
import { saveTheme, applyTheme } from "../lib/theme.js";
import { setSoundMuted } from "../lib/sound.js";

export default function SettingsPanel({ settings, onChange, onClose }) {
  function update(key, value) {
    onChange(key, value);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-md animate-fadeUp p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Setări"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">⚙️ Setări</h2>
          <button onClick={onClose} className="btn-sm" aria-label="Închide setările">
            ✕
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {/* ---------- sunet ---------- */}
          <Row label="Sunete de joc" hint="Efectele Web Audio în timpul jocului">
            <Toggle
              checked={!settings.soundMuted}
              onChange={(value) => {
                update("soundMuted", !value);
                setSoundMuted(!value);
              }}
              labelOn="Pornite"
              labelOff="Oprite"
            />
          </Row>

          {/* ---------- limita greseli ---------- */}
          <Row label="Limită greșeli" hint="La depășire, puzzle-ul se reia de la zero">
            <div className="flex gap-1.5">
              {[
                { value: 0, label: "Nelimitat" },
                { value: 5, label: "5" },
                { value: 3, label: "3" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => update("mistakesLimit", option.value)}
                  className={`btn-sm ${
                    settings.mistakesLimit === option.value ? "chip-active" : "chip-idle"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Row>

          {/* ---------- tema ---------- */}
          <Row label="Temă" hint="Aplicație instant, fără reload">
            <div className="flex gap-1.5">
              {[
                { value: "dark", label: "🌙 Întunecat" },
                { value: "light", label: "☀️ Luminos" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    update("theme", option.value);
                    applyTheme(option.value); // feedback instant
                    saveTheme(option.value);
                  }}
                  className={`btn-sm ${
                    settings.theme === option.value ? "chip-active" : "chip-idle"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Row>
        </div>

        <p className="mt-5 text-[0.65rem] leading-relaxed text-muted/70">
          Setările se salvează automat în acest browser.
        </p>
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[0.65rem] text-muted">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, labelOn, labelOff }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`btn-sm min-w-24 ${checked ? "chip-active" : "chip-idle"}`}
      aria-pressed={checked}
    >
      {checked ? labelOn : labelOff}
    </button>
  );
}
