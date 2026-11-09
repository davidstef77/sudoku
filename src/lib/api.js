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

/** Statusuri dupa care merita reincercat (server pornind / suprasolicitat). */
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const MESSAGES = {
  timeout:
    "Serverul răspunde greu (probabil tocmai pornește). Mai încearcă o dată în câteva secunde.",
  network: "Nu mă pot conecta la server. Verifică conexiunea la internet și reîncearcă.",
  unavailable: "Serverul nu este disponibil momentan. Reîncearcă în câteva secunde.",
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * O singura incercare. Erorile de retea si timeout-ul sunt traduse in mesaje
 * clare — inainte utilizatorul vedea textul brut al browserului
 * ("Fetch is aborted" in Safari, "signal is aborted..." in Chrome).
 */
async function attempt(path, { method, body, timeoutMs }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // Abort CU motiv: fara argument, Chrome logheaza zgomotos in consola.
    controller.abort(new DOMException("Request timeout", "TimeoutError"));
  }, timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    // Safari ignora motivul abort-ului, deci ne bazam pe propriul flag.
    const kind = timedOut || cause?.name === "AbortError" || cause?.name === "TimeoutError"
      ? "timeout"
      : "network";
    const error = new Error(MESSAGES[kind]);
    error.code = kind;
    error.retryable = true;
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.error ||
        (RETRYABLE_STATUS.has(response.status)
          ? MESSAGES.unavailable
          : `Eroare HTTP ${response.status}`)
    );
    error.status = response.status;
    error.payload = data;
    error.retryable = RETRYABLE_STATUS.has(response.status);
    throw error;
  }

  return data;
}

/**
 * Request cu reincercari: la timeout, eroare de retea sau 502/503/504 mai
 * incercam (cu o pauza scurta). Prima cerere dupa o perioada de inactivitate
 * poate prinde un "cold start" Vercel + conectarea la MongoDB Atlas.
 * Inregistrarea NU se reincearca (ar putea crea contul de doua ori).
 *
 * Arunca eroare daca !ok, cu JSON-ul de eroare in `error.payload`.
 */
async function request(path, { method = "GET", body, timeoutMs = 15000, retries = 1 } = {}) {
  for (let attemptNo = 0; ; attemptNo++) {
    try {
      return await attempt(path, { method, body, timeoutMs });
    } catch (error) {
      if (!error.retryable || attemptNo >= retries) throw error;
      await wait(1500 * (attemptNo + 1));
    }
  }
}

/**
 * "Trezeste" serverul (fara asteptare, fara erori): apelat cand utilizatorul
 * deschide fereastra de autentificare, ca pana apasa "Intra in cont"
 * functia serverless sa fie deja pornita si conectata la baza.
 */
export function warmUp() {
  fetch(`${API_BASE}/api/health`, { method: "GET" }).catch(() => {});
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
      timeoutMs: 25000,
      retries: 0, // nu dublam crearea contului
    });
    setToken(data.token);
    return data.user;
  },

  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password },
      timeoutMs: 20000,
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
    await request("/auth/me", { method: "DELETE", body: { password }, retries: 0 });
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
      timeoutMs: 25000,
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
