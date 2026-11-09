/**
 * Panoul contului (pentru utilizatorul autentificat):
 *   - schimbarea numelui afisat in clasament  (PATCH /api/auth/me);
 *   - delogare;
 *   - stergerea definitiva a contului           (DELETE /api/auth/me).
 * Progresul local din acest browser ramane in toate cazurile.
 */

import { useState } from "react";
import api from "../lib/api.js";

const NAME_MAX = 40;

export default function AccountModal({ user, onClose, onUpdated, onLoggedOut, onDeleted }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState(null); // { type, text }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const nameChanged = displayName.trim() !== (user?.displayName || "");

  async function saveName(event) {
    event.preventDefault();
    if (savingName || !nameChanged) return;

    setSavingName(true);
    setNameMessage(null);
    try {
      const updated = await api.updateProfile({ displayName });
      onUpdated?.(updated);
      setDisplayName(updated?.displayName || "");
      setNameMessage({ type: "ok", text: "Numele a fost salvat." });
    } catch (error) {
      setNameMessage({ type: "error", text: error.message || "Nu s-a putut salva." });
    } finally {
      setSavingName(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (deleting) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAccount(password);
      onDeleted?.();
    } catch (error) {
      setDeleteError(error.message || "Contul nu a putut fi șters.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-sm animate-fadeUp p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Contul meu"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">👤 Contul meu</h2>
          <button onClick={onClose} className="btn-sm" aria-label="Închide">
            ✕
          </button>
        </div>

        <p className="mt-1 truncate text-xs text-muted" title={user?.email}>
          {user?.email}
        </p>

        {/* ---------- nume afisat ---------- */}
        <form onSubmit={saveName} className="mt-5 flex flex-col gap-2">
          <label htmlFor="account-name" className="text-sm font-semibold text-white">
            Nume afișat
          </label>
          <p className="text-[0.65rem] text-muted">
            Apare în clasament. Lăsat gol, vei apărea ca „Jucător #…”.
          </p>
          <div className="flex gap-2">
            <input
              id="account-name"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setNameMessage(null);
              }}
              placeholder="Numele tău"
              maxLength={NAME_MAX}
              className="input min-w-0 flex-1"
              autoComplete="nickname"
            />
            <button
              type="submit"
              disabled={savingName || !nameChanged}
              className="btn-primary shrink-0 px-4 text-xs disabled:opacity-50"
            >
              {savingName ? "..." : "Salvează"}
            </button>
          </div>
          {nameMessage && (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${
                nameMessage.type === "ok" ? "bg-accent/10 text-accent" : "bg-rose/10 text-rose"
              }`}
              role="status"
            >
              {nameMessage.text}
            </p>
          )}
        </form>

        {/* ---------- delogare ---------- */}
        <button onClick={onLoggedOut} className="btn-ghost mt-5 w-full text-sm">
          Ieși din cont
        </button>

        {/* ---------- stergere cont ---------- */}
        <div className="mt-5 border-t border-white/10 pt-4">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-center text-xs text-rose/80 transition hover:text-rose"
            >
              Șterge contul definitiv…
            </button>
          ) : (
            <form onSubmit={deleteAccount} className="flex flex-col gap-2">
              <p className="text-xs leading-relaxed text-rose">
                Se șterg de pe server contul, progresul sincronizat, XP-ul și realizările.
                Acțiunea nu poate fi anulată. Progresul local din acest browser rămâne.
              </p>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setDeleteError("");
                }}
                placeholder="Confirmă cu parola"
                className="input"
                autoComplete="current-password"
                autoFocus
              />
              {deleteError && (
                <p className="rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    setPassword("");
                    setDeleteError("");
                  }}
                  className="btn-ghost flex-1 text-xs"
                >
                  Renunță
                </button>
                <button
                  type="submit"
                  disabled={deleting || !password}
                  className="flex-1 rounded-xl bg-rose/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose disabled:opacity-50"
                >
                  {deleting ? "Se șterge..." : "Șterge contul"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
