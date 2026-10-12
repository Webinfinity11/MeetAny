const LEGAL_FORMS = new Set(["შპს", "სს", "იმ", "ი/მ", "llc", "ltd", "inc"]);

/**
 * Up to two initials from a name. Quotes („“”"'«») and punctuation never count as letters, legal forms are
 * skipped, Georgian stays in mkhedruli (mtavruli input is lowered) and other scripts are upper-cased.
 * @param {string} name
 * @returns {string}
 */
export function avatarInitials(name) {
  const words = String(name || "").split(/\s+/)
    .filter(w => !LEGAL_FORMS.has(w.toLowerCase().replace(/[^\p{L}/]/gu, "")))
    .map(w => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (!words.length) return "?";
  const [first, second] = words.map(w => Array.from(w));
  const letters = second ? [first[0], second[0]] : first.slice(0, 2);
  return letters.map(ch => /\p{Script=Georgian}/u.test(ch) ? ch.toLowerCase() : ch.toUpperCase()).join("");
}
