/**
 * Efecte sonore generate direct cu Web Audio API — fara fisiere audio.
 *
 * Contextul audio este creat si reluat doar dupa o interactiune a
 * utilizatorului (click / tasta), asa cum cer browserele.
 * Sunetele sunt simple si discrete: tonuri scurte cu volum mic.
 */

let audioContext = null;
let muted = false;

/** Activeaza / dezactiveaza sunetele la nivel global. */
export function setSoundMuted(value) {
  muted = Boolean(value);
}

function getContext() {
  if (typeof window === "undefined") return null;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // browserul poate refuza reluarea fara gest explicit; ignoram
    });
  }

  return audioContext;
}

/**
 * Reda un singur ton scurt.
 * @param {object} options
 * @param {number} options.frequency  frecventa de start (Hz)
 * @param {number} options.duration   durata in secunde
 * @param {string} options.type       tipul de oscilator (sine, triangle, sawtooth...)
 * @param {number} options.volume     volum 0..1 (valori mici, ex: 0.06..0.15)
 * @param {number} options.delay      intarziere in secunde
 * @param {number} options.slideTo    frecventa finala (glissando)
 */
function tone({
  frequency = 440,
  duration = 0.12,
  type = "sine",
  volume = 0.12,
  delay = 0,
  slideTo = null,
}) {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  }

  // Anvelopa scurta: atac rapid, decay lin, fara pocnituri.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export const sounds = {
  /** Click subtil la selectarea unei celule. */
  select() {
    tone({ frequency: 520, duration: 0.05, type: "triangle", volume: 0.06 });
  },

  /** Bip scurt la adaugarea / scoaterea unei notite. */
  note() {
    tone({ frequency: 620, duration: 0.045, type: "triangle", volume: 0.055 });
  },

  /** Cifra corecta plasata: urcare placuta 660 -> 880 Hz. */
  correct() {
    tone({ frequency: 660, duration: 0.13, type: "sine", volume: 0.14, slideTo: 880 });
  },

  /** Cifra gresita (respinasa): sunet grav, scurt, de avertizare. */
  wrong() {
    tone({ frequency: 190, duration: 0.2, type: "sawtooth", volume: 0.07, slideTo: 120 });
  },

  /** Stergerea unei cifre / notite: coborare scurta. */
  erase() {
    tone({ frequency: 440, duration: 0.09, type: "sine", volume: 0.08, slideTo: 300 });
  },

  /** Undo: sunet scurt in jos. */
  undo() {
    tone({ frequency: 340, duration: 0.09, type: "triangle", volume: 0.08, slideTo: 240 });
  },

  /** Hint: doua tonuri scurte, in sus. */
  hint() {
    tone({ frequency: 784, duration: 0.09, type: "sine", volume: 0.11 });
    tone({ frequency: 988, duration: 0.12, type: "sine", volume: 0.11, delay: 0.09 });
  },

  /** Reset manual al puzzle-ului: ton in jos. */
  reset() {
    tone({ frequency: 400, duration: 0.14, type: "triangle", volume: 0.09, slideTo: 200 });
  },

  /** Puzzle rezolvat: mica fanfara C-E-G-C. */
  complete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      tone({
        frequency,
        duration: 0.18,
        type: "sine",
        volume: 0.13,
        delay: index * 0.11,
      });
    });
  },
};
