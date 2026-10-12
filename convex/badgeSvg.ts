// README badge renderer. Output matches badge.fury.io, the npm version badge Convex component
// READMEs show, so our badge looks like the same family when the two sit together.

import { DEJAVU_SANS_GLYPHS, DEJAVU_SANS_KERNING, DEJAVU_UNITS_PER_EM } from "./badgeGlyphs";

export const BADGE_LABEL_COLOR = "#555";

export const BADGE_COLORS = {
  approved: "#4c1",
  in_review: "#2563eb",
  changes_requested: "#ea580c",
  pending: "#ca8a04",
  rejected: "#dc2626",
  not_found: "#6b6b6b",
} as const;

// Badge text is DejaVu Sans 11px on a 14px baseline
const FONT_SCALE = 11 / DEJAVU_UNITS_PER_EM;
const BASELINE = 14;

// Characters outside printable ASCII draw as "?"
const FALLBACK_GLYPH = DEJAVU_SANS_GLYPHS["?".charCodeAt(0) - 32];

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function glyphFor(char: string): readonly [number, string] {
  const code = char.codePointAt(0) ?? 0;
  return DEJAVU_SANS_GLYPHS[code - 32] ?? FALLBACK_GLYPH;
}

function kerningBetween(previous: string | undefined, char: string): number {
  return previous === undefined ? 0 : (DEJAVU_SANS_KERNING[previous + char] ?? 0);
}

export function measureText(str: string): number {
  let units = 0;
  let previous: string | undefined;
  for (const char of str) {
    units += kerningBetween(previous, char) + glyphFor(char)[0];
    previous = char;
  }
  return units * FONT_SCALE;
}

function px(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

// Lays glyph outlines along the pen, flipping font units (y up) into SVG space
function textOutline(str: string, x: number): string {
  let d = "";
  let pen = 0;
  let previous: string | undefined;
  for (const char of str) {
    const [advance, outline] = glyphFor(char);
    pen += kerningBetween(previous, char);
    previous = char;
    d += outline.replace(
      /(-?[\d.]+) (-?[\d.]+)/g,
      (_match, gx: string, gy: string) =>
        `${px(x + (pen + Number(gx)) * FONT_SCALE)} ${px(BASELINE - Number(gy) * FONT_SCALE)}`,
    );
    pen += advance;
  }
  return d;
}

export function renderBadge({
  label,
  message,
  color,
}: {
  label: string;
  message: string;
  color: string;
}): string {
  const labelText = label.trim();
  const messageText = message.trim();

  // fury pads label text 6px each side and message text 5px left, 6px right
  const leftWidth = Math.ceil(measureText(labelText)) + 12;
  const rightWidth = Math.ceil(measureText(messageText)) + 11;
  const width = leftWidth + rightWidth;
  const outline = textOutline(labelText, 6) + textOutline(messageText, leftWidth + 5);

  // Square fill covers the colored box's left rounded corners
  const seamWidth = Math.min(13, rightWidth - 3);
  const accessibleText = `${escapeXml(labelText)}: ${escapeXml(messageText)}`;

  // One text outline drawn twice: crisp shadow 1px lower, then white text with a thin stroke
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="20" role="img" aria-label="${accessibleText}"><title>${accessibleText}</title><defs><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><path id="t" d="${outline}"/></defs><rect width="${width}" height="20" rx="3" fill="${BADGE_LABEL_COLOR}"/><rect x="${leftWidth}" width="${rightWidth}" height="20" rx="3" fill="${color}"/><rect x="${leftWidth}" width="${seamWidth}" height="20" fill="${color}"/><rect width="${width}" height="20" rx="3" fill="url(#s)"/><use xlink:href="#t" y="1" fill="#010101" fill-opacity=".3" stroke="#010101" stroke-opacity=".102" stroke-width=".3"/><use xlink:href="#t" fill="#fff" stroke="#fff" stroke-width=".3"/></svg>`;
}
