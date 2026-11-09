/**
 * Modal de autentificare: logare si inregistrare.
 * Dupa autentificare, progresul local este sincronizat automat cu serverul.
 */

import { useEffect, useState } from "react";
import api, { warmUp } from "../lib/api.js";

export default function AuthModal({ onClose, onAuthenticated, onError }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Pornim serverul cat timp utilizatorul completeaza formularul.
  useEffect(() => {
    warmUp();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const user =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, displayName);
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError.message || "Ceva nu a mers.");
      onError?.(requestError);
    } finally {
      setBusy(false);
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
        aria-label={mode === "login" ? "Autentificare" : "Înregistrare"}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {mode === "login" ? "🔐 Autentificare" : "✨ Cont nou"}
          </h2>
          <button onClick={onClose} className="btn-sm" aria-label="Închide">
            ✕
          </button>
        </div>

        <p className="mt-1 text-xs text-muted">
          Contul sincronizează progresul și statisticile pe toate dispozitivele.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          {mode === "register" && (
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nume (opțional)"
              maxLength={40}
              className="input"
              autoComplete="nickname"
            />
          )}

          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemplu.ro"
            className="input"
            autoComplete="email"
          />

          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Parolă (minim 6 caractere)"
            className="input"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-1 text-sm">
            {busy ? "Se trimite..." : mode === "login" ? "Intră în cont" : "Creează cont"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="mt-4 w-full text-center text-xs text-muted transition hover:text-white"
        >
          {mode === "login"
            ? "Nu ai cont? Creează unul →"
            : "Ai deja cont? Autentifică-te →"}
        </button>
      </div>
    </div>
  );
}
