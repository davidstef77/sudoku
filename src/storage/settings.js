/**
 * Setarile aplicatiei: sunet, limita de greseli, tema.
 * Salvate individual in AsyncStorage (localStorage), cu valori implicite.
 */

import AsyncStorage, { STORAGE_KEYS } from "./asyncStorage.js";

export const DEFAULT_SETTINGS = {
  soundMuted: false, // sunetele Web Audio: pornite
  mistakesLimit: 5, // 0 = nelimitat, 3 sau 5 = reset automat la depasire
  theme: "dark", // "dark" | "light"
};

/**
 * Citeste toate setarile, cu fallback pe fiecare cheie in parte
 * (o setare corupta nu strica restul).
 */
export async function loadSettings() {
  const [soundMuted, mistakesLimit, theme] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.soundMuted),
    AsyncStorage.getItem(STORAGE_KEYS.mistakesLimit),
    AsyncStorage.getItem(STORAGE_KEYS.theme),
  ]);

  return {
    soundMuted: soundMuted === "true",
    mistakesLimit: ["0", "3", "5"].includes(mistakesLimit)
      ? Number(mistakesLimit)
      : DEFAULT_SETTINGS.mistakesLimit,
    theme: theme === "light" ? "light" : "dark",
  };
}

/** Salveaza o setare individuala si returneaza valoarea normalizata. */
export async function saveSetting(key, value) {
  let stored = value;

  switch (key) {
    case "soundMuted":
      stored = value ? "true" : "false";
      break;
    case "mistakesLimit": {
      const numeric = Number(value);
      stored = [0, 3, 5].includes(numeric) ? String(numeric) : "5";
      break;
    }
    case "theme":
      stored = value === "light" ? "light" : "dark";
      break;
    default:
      break;
  }

  await AsyncStorage.setItem(STORAGE_KEYS[key], stored);
  return stored;
}
