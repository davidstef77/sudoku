/**
 * PostCSS: Tailwind + Autoprefixer + un mic plugin de compatibilitate.
 *
 * Tailwind v3 genereaza culori cu sintaxa moderna `rgb(255 255 255 / .1)`.
 * Unele browsere (in special versiuni mai vechi de Safari / Chrome / WebView)
 * nu inteleg sintaxa cu spatiu + slash si ignora declaratia, asa ca paginile
 * arata cu alte culori. Plugin-ul transforma acele valori in `rgba(...)`
 * clasic, acceptat peste tot. Transforma si `#rrggbbaa` in `rgba(...)` pentru
 * compatibilitate maxima (minificatorul le poate scurta inapoi la `#rrggbbaa`,
 * dar acea sintaxa e tot mult mai veche si mai suportata decat `rgb(... / ...)`).
 */

import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import valueParser from "postcss-value-parser";

function splitTopLevel(nodes, separator) {
  const groups = [];
  let current = [];

  for (const node of nodes) {
    if (node.type === "div" && node.value === separator) {
      groups.push(current);
      current = [];
    } else if (node.type !== "space") {
      current.push(node);
    }
  }
  groups.push(current);
  return groups;
}

/** Transforma #rrggbbaa (hex cu alpha) in rgba(...), pentru browsere vechi. */
function transformHex8(node) {
  if (node.type !== "word") return false;
  const value = node.value;
  if (!/^#[0-9a-fA-F]{8}$/.test(value)) return false;

  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  const a = Math.round((parseInt(value.slice(7, 9), 16) / 255) * 1000) / 1000;

  node.value = `rgba(${r}, ${g}, ${b}, ${a})`;
  return true;
}

function transformModernColorFunction(fn) {
  const name = fn.value.toLowerCase();

  // Doar rgb/hsl (si eventualele lor aliasuri) ne intereseaza.
  if (!["rgb", "rgba", "hsl", "hsla"].includes(name)) return false;

  // Daca are deja virgula, e sintaxa clasica; o lasam in pace.
  const hasComma = fn.nodes.some((node) => node.type === "div" && node.value === ",");
  if (hasComma) return false;

  const parts = splitTopLevel(fn.nodes, "/");
  const baseNodes = parts[0].filter((node) => node.type !== "space");

  // Trebuie sa avem exact 3 componente de baza (r g b / h s l).
  if (baseNodes.length !== 3) return false;

  const hasAlpha = parts.length > 1;
  if (parts.length > 2) return false;

  const alphaNodes = hasAlpha
    ? parts[1].filter((node) => node.type !== "space")
    : [];

  if (hasAlpha && alphaNodes.length !== 1) return false;

  // Reconstruim lista de noduri cu virgule si spatii.
  const newNodes = [];
  baseNodes.forEach((node, index) => {
    if (index > 0) {
      newNodes.push({ type: "div", value: ",", before: "", after: " " });
    }
    newNodes.push({ ...node, before: "", after: "" });
  });

  if (hasAlpha) {
    newNodes.push({ type: "div", value: ",", before: "", after: " " });
    newNodes.push({ ...alphaNodes[0], before: "", after: "" });
  }

  fn.value = hasAlpha ? (name.endsWith("a") ? name : `${name}a`) : name;
  fn.nodes = newNodes;
  return true;
}

function legacyColorSyntax() {
  return {
    postcssPlugin: "legacy-color-syntax",
    Declaration(decl) {
      const ast = valueParser(decl.value);
      let changed = false;

      ast.walk((node) => {
        if (node.type === "function" && transformModernColorFunction(node)) {
          changed = true;
        } else if (node.type === "word" && transformHex8(node)) {
          changed = true;
        }
      });

      if (changed) decl.value = ast.toString();
    },
  };
}
legacyColorSyntax.postcss = true;

export default {
  plugins: [tailwindcss(), autoprefixer(), legacyColorSyntax()],
};
