import chalk, { type ChalkInstance } from "chalk";

/** fieldnote pine — packages/design-system/styles/tokens.css, --fn-pine-700. */
export const BRAND_PINE = "#315b4d";

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
 * Render the startup banner: the Field Lines mark in brand pine, the
 * wordmark beside it, and a plain tagline beneath.
 *
 * Pass a chalk instance to control colouring deterministically — chalk
 * auto-detects terminal support (honoring NO_COLOR / FORCE_COLOR / TTY)
 * when the default is used, and tests can force a level with
 * `new Chalk({ level })`.
 */
export function renderBanner(c: ChalkInstance = chalk): string {
  const pine = c.hex(BRAND_PINE);
  const lines = MARK.map((line, i) =>
    i === 1 ? `${pine(line)}  ${c.bold("fieldnote")}` : pine(line),
  );
  lines.push("", `  ${TAGLINE}`);
  return lines.join("\n");
}
