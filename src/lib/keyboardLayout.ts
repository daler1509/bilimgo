/**
 * Text typed with the wrong keyboard layout: «шудеы» → «ielts», «rjhtqcrbq» →
 * «корейский». Common on phones switching between Russian and Latin input.
 * Returns null when there is nothing to switch.
 */
const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю';
const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const TO_EN = new Map([...RU].map((ch, i) => [ch, EN[i]!]));
const TO_RU = new Map([...EN].map((ch, i) => [ch, RU[i]!]));

export function switchLayout(input: string): string | null {
  const text = input.toLowerCase();
  const cyrillic = (text.match(/[а-яё]/g) ?? []).length;
  const latin = (text.match(/[a-z]/g) ?? []).length;
  if (!cyrillic && !latin) return null;
  const map = cyrillic >= latin ? TO_EN : TO_RU;
  const out = [...text].map((ch) => map.get(ch) ?? ch).join('').trim();
  return out && out !== text.trim() ? out : null;
}
