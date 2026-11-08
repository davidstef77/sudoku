/**
 * Feedback haptic pe telefoane (Vibration API).
 * Pe dispozitive fara suport (desktop, iOS Safari) apelurile sunt no-op.
 */

function vibrate(pattern) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const haptics = {
  /** Atingere scurta, la plasarea corecta a unei cifre. */
  light() {
    vibrate(12);
  },

  /** Vibratie ferma, la o greseala respinsa. */
  wrong() {
    vibrate(80);
  },

  /** Seria scurta de la finalul puzzle-ului. */
  complete() {
    vibrate([30, 60, 30, 60, 80]);
  },

  /** Notita adaugata / stearsa. */
  tick() {
    vibrate(8);
  },
};

export default haptics;
