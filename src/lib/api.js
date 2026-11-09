/**
 * Client API pentru backend-ul Sudoku 1000 (Express + JWT + MongoDB).
 * Tokenul JWT e pastrat in localStorage (prefixat de AsyncStorage) si
 * trimis ca Bearer la fiecare request.
 *
 * URL-ul de baza: VITE_API_URL din .env (prod), gol in dev (proxy Vite).
 */

import AsyncStorage, { STORAGE_KEYS } from "../storage/asyncStorage.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders() {
  const token = tokenCache;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let tokenCache = null;

/** Citeste tokenul o singura data (restul apelurilor vin din cache). */
export async function initToken() {
  tokenCache = await AsyncStorage.getItem(STORAGE_KEYS.token);
  return tokenCache;
}

export function getToken() {
  return tokenCache;
}

export function setToken(token) {
  tokenCache = token;
  if (token) {
    AsyncStorage.setItem(STORAGE_KEYS.token, token);
  } else {
    AsyncStorage.removeItem(STORAGE_KEYS.token);
  }
}

/**
 * Request generos: arunca eroare daca !ok, dar returneaza JSON-ul de eroare
 * in `error.payload` ca UI-ul sa poata afisa mesajul serverului.
 */
async function request(path, { method = "GET", body, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    // Abort CU motiv: fara argument, Chrome logheaza zgomotos in consola
    // "signal is aborted without reason" la fiecare timeout.
    controller.abort(new DOMException("Request timeout", "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `Eroare HTTP ${response.status}`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- auth ----------------

export const api = {
  // Expus si pe obiect: App.jsx apeleaza `api.getToken()`. Lipsa lui facea ca
  // ORICE sincronizare sa arunce TypeError (si, la pornire, sa delogheze).
  getToken,

  async register(email, password, displayName) {
    const data = await request("/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    });
    setToken(data.token);
    return data.user;
  },

  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(data.token);
    return data.user;
  },

  logout() {
    setToken(null);
  },

  async me() {
    // 20s: prima cerere poate prinde un "cold start" Vercel + conectarea la Atlas.
    const data = await request("/auth/me", { timeoutMs: 20000 });
    return data.user;
  },

  /** Schimba numele afisat (apare in clasament). */
  async updateProfile({ displayName }) {
    const data = await request("/auth/me", { method: "PATCH", body: { displayName } });
    return data.user;
  },

  /** Sterge definitiv contul si toate datele de pe server (cere parola). */
  async deleteAccount(password) {
    await request("/auth/me", { method: "DELETE", body: { password } });
    setToken(null);
  },

  // ---------------- progres ----------------

  async fetchAllProgress() {
    return request("/progress");
  },

  /**
   * Sincronizare bulk: trimitem intrarile modificate local si statisticile,
   * primim inapoi starea combinata server + local.
   */
  async syncProgress(entries, stats, daily) {
    return request("/progress/sync", {
      method: "PUT",
      body: { entries, stats, daily },
      timeoutMs: 20000,
    });
  },

  async resetServerProgress() {
    return request("/progress/reset", { method: "POST" });
  },

  // ---------------- gamification ----------------

  /** Realizarile + progresul + profilul XP (evaluat pe server). */
  async fetchAchievements() {
    return request("/achievements");
  },

  /**
   * Clasamentul.
   * @param {{scope?: "global"|"weekly"|"monthly", sort?: string}} options
   */
  async fetchLeaderboard({ scope = "global", sort = "xp" } = {}) {
    const params = new URLSearchParams({ scope, sort });
    return request(`/leaderboard?${params.toString()}`);
  },
};

export default api;
