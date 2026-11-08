/**
 * Tema aplicatiei: "dark" (implicit) sau "light".
 * Tema este un clas CSS pe <html> (dark = default, light = clasa "light"),
 * culorile fiind definite prin variabile CSS in index.css.
 */

import AsyncStorage, { STORAGE_KEYS } from "../storage/asyncStorage.js";

export const THEMES = ["dark", "light"];

/** Aplica tema pe document: clasa CSS + meta theme-color (bara browserului). */
export function applyTheme(theme) {
  const light = theme === "light";
  const root = document.documentElement;

  root.classList.toggle("light", light);
  root.classList.remove("dark"); // curatenie: "dark" e default prin CSS

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", light ? "#fafafa" : "#07070f");

  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", light ? "light" : "dark");
}

/** Citeste tema salvata (default: dark). */
export async function loadTheme() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.theme);
  return saved === "light" ? "light" : "dark";
}

/** Salveaza si aplica tema. */
export async function saveTheme(theme) {
  const safe = THEMES.includes(theme) ? theme : "dark";
  await AsyncStorage.setItem(STORAGE_KEYS.theme, safe);
  applyTheme(safe);
  return safe;
}
