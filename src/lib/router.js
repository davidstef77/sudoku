/**
 * Router minimal pe hash (#/...), fara dependente.
 *
 * De ce hash si nu History API: aplicatia e publicata pe GitHub Pages sub
 * /sudoku/, unde un refresh pe /sudoku/clasament ar da 404 (nu exista
 * rewrite catre index.html). Cu #/clasament serverul vede mereu /sudoku/.
 *
 * Rute:
 *   #/                 acasa (nivelurile)
 *   #/nivel/:level     lista unui nivel (easy, medium, ...)
 *   #/puzzle/:id       jocul (1..1000)
 *   #/zilnic           provocarea zilei
 *   #/realizari        realizarile
 *   #/clasament        clasamentul
 *   #/turing           jocul bonus
 */

import { useCallback, useEffect, useState } from "react";

export const ROUTES = {
  home: () => "/",
  level: (level) => `/nivel/${encodeURIComponent(level)}`,
  puzzle: (id) => `/puzzle/${id}`,
  daily: () => "/zilnic",
  achievements: () => "/realizari",
  leaderboard: () => "/clasament",
  turing: () => "/turing",
};

const STATIC_ROUTES = {
  "/": "home",
  "/zilnic": "daily",
  "/realizari": "achievements",
  "/clasament": "leaderboard",
  "/turing": "turing",
};

/** Calea curenta din hash, normalizata ("/..." fara slash final). */
export function currentPath(hash = typeof window !== "undefined" ? window.location.hash : "") {
  let path = String(hash || "").replace(/^#/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.split("?")[0];
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/**
 * Transforma o cale in { name, params }. Rutele necunoscute -> name "notFound".
 * Validarea parametrilor (nivel existent, puzzle existent) ramane in App.
 */
export function parseRoute(path) {
  const normalized = currentPath(path);
  if (STATIC_ROUTES[normalized]) return { name: STATIC_ROUTES[normalized], params: {} };

  let match = normalized.match(/^\/nivel\/([a-z]+)$/);
  if (match) return { name: "level", params: { level: match[1] } };

  match = normalized.match(/^\/puzzle\/(\d{1,6})$/);
  if (match) return { name: "puzzle", params: { id: Number(match[1]) } };

  return { name: "notFound", params: {} };
}

/**
 * Hook-ul routerului.
 * @returns {{ route, path, navigate, goBack }}
 *   navigate(path, { replace }) — schimba ruta (push implicit);
 *   goBack(fallback) — revine la ecranul anterior DACA el e `fallback`
 *     (history.back, ca butonul Back sa nu creeze bucle), altfel il
 *     inlocuieste pe cel curent cu `fallback` (ex. dupa un link direct).
 */
export function useRouter() {
  const [path, setPath] = useState(() => currentPath());

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const target = currentPath(to);
    const from = currentPath();
    if (target === from) return;

    const url = `${window.location.pathname}${window.location.search}#${target}`;
    if (replace) {
      window.history.replaceState({ from: window.history.state?.from ?? null }, "", url);
    } else {
      window.history.pushState({ from }, "", url);
    }
    setPath(target);
    window.scrollTo?.(0, 0);
  }, []);

  const goBack = useCallback(
    (fallback = "/") => {
      const target = currentPath(fallback);
      if (window.history.state?.from === target) {
        window.history.back(); // popstate actualizeaza ruta
      } else {
        navigate(target, { replace: true });
      }
    },
    [navigate]
  );

  return { route: parseRoute(path), path, navigate, goBack };
}
