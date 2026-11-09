/**
 * AsyncStorage pentru web.
 *
 * Ofera aceeasi API ca @react-native-async-storage/async-storage
 * (getItem / setItem / removeItem / multiGet / multiSet / getAllKeys / clear),
 * dar in spate foloseste window.localStorage si returneaza mereu Promise-uri.
 */

// v2: puzzle-urile au fost regenerate pe 6 niveluri, asa ca progresul vechi
// (care avea alte puzzle-uri pe aceleasi id-uri) nu mai este valabil.
const PREFIX = "sudoku1000:v2:";

/** Cheile salvate de noi (nu atingem alte date din localStorage). */
function isOurs(key) {
  return key.startsWith(PREFIX);
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const AsyncStorage = {
  /** Citeste o cheie. Returneaza null daca nu exista. */
  async getItem(key) {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : raw;
  },

  /** Scrie o valoare (string sau obiect, care va fi serializat). */
  async setItem(key, value) {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    window.localStorage.setItem(PREFIX + key, raw);
    return true;
  },

  /** Sterge o cheie. */
  async removeItem(key) {
    window.localStorage.removeItem(PREFIX + key);
    return true;
  },

  /** Citeste mai multe chei: [[key, value], ...]. */
  async multiGet(keys) {
    return keys.map((key) => [key, window.localStorage.getItem(PREFIX + key)]);
  },

  /** Scrie mai multe perechi: [[key, value], ...]. */
  async multiSet(pairs) {
    for (const [key, value] of pairs) {
      const raw = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(PREFIX + key, raw);
    }
    return true;
  },

  /** Toate cheile noastre, fara prefix. */
  async getAllKeys() {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && isOurs(key)) keys.push(key.slice(PREFIX.length));
    }
    return keys;
  },

  /** Sterge doar datele acestei aplicatii. */
  async clear() {
    const keys = await AsyncStorage.getAllKeys();
    keys.forEach((key) => window.localStorage.removeItem(PREFIX + key));
    return true;
  },

  /** Helper: citeste JSON deserializat, cu fallback. */
  async getJSON(key, fallback = null) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = safeParse(raw);
    return parsed ?? fallback;
  },

  /** Helper: scrie JSON. */
  async setJSON(key, value) {
    return AsyncStorage.setItem(key, JSON.stringify(value));
  },
};

export default AsyncStorage;

// ---------------- chei folosite in aplicatie ----------------

export const STORAGE_KEYS = {
  progress: (id) => `progress:${id}`,
  stats: "stats",
  lastPlayed: "lastPlayed",
  soundMuted: "soundMuted",
  mistakesLimit: "mistakesLimit",
  theme: "theme",
  token: "token",
  user: "user", // ultimul profil de cont cunoscut (afisat si offline)
  dailyState: "dailyState",
  profile: "profile",
};
