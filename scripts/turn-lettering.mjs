// Turn's hand lettering. TEMPORARY STUB: renders the word as italic serif text until the monoline alphabet lands.
// Contract (keep it): letteringSvg({ word, className }) → an inline <svg> string, aria-hidden, using
// stroke="currentColor", one <path data-stroke="…"> per pen stroke in writing order, and a viewBox cropped to the word
// with the baseline at a known fraction (exported per word as data-baseline on the <svg>).
export function letteringSvg({ word, className = 'lettering' }) {
  const w = Math.max(60, word.length * 34);
  return `<svg class="${className}" viewBox="0 0 ${w} 80" data-word="${word}" data-baseline="0.75" aria-hidden="true" focusable="false"><text x="2" y="60" font-family="Instrument Serif, serif" font-style="italic" font-size="64" fill="currentColor">${word}</text></svg>`;
}
