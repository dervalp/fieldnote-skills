import chalk, { type ChalkInstance } from "chalk";

/**
 * fieldnote ember — the accent the product strokes its mark with.
 *
 * In the product's design system the lockup is two colours: the mark takes
 * `--fn-color-accent` (→ `--fn-ember-600`, #BE421F) and the wordmark takes
 * `--fn-color-ink` (→ `--fn-pine-900`, #203F36). The shipped favicon strokes
 * all three of the mark's paths in this same ember.
 */
export const BRAND_EMBER = "#BE421F";

/**
 * The Field Lines mark: three nested contours rising and turning right,
 * the same three paths the product's SVG draws.
 */
const MARK = [
  " ╭─────",
  " │╭────",
  " ││╭───",
  " │││",
];

const TAGLINE = "the delivery loop, as skills";

/**
 * Render the startup banner: the Field Lines mark in brand ember, the
 * wordmark beside it, and a plain tagline beneath.
 *
 * The wordmark is deliberately NOT painted in the product's ink (pine-900).
 * That colour sits at roughly 4% luminance — correct on the product's paper
 * background, all but invisible on the dark terminal most engineers run, and
 * a terminal's background colour is not something we can read from here.
 * Plain bold inherits whatever foreground the user's theme already proved
 * legible, so the wordmark reads on light and dark alike.
 *
 * Pass a chalk instance to control colouring deterministically — chalk
 * auto-detects terminal support (honoring NO_COLOR / FORCE_COLOR / TTY)
 * when the default is used, and tests can force a level with
 * `new Chalk({ level })`.
 */
export function renderBanner(c: ChalkInstance = chalk): string {
  const ember = c.hex(BRAND_EMBER);
  const lines = MARK.map((line, i) =>
    i === 1 ? `${ember(line)}  ${c.bold("fieldnote")}` : ember(line),
  );
  lines.push("", `  ${TAGLINE}`);
  return lines.join("\n");
}
