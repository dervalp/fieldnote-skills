import chalk, { type ChalkInstance } from "chalk";

/** Vertuoza brand blue. */
export const BRAND_BLUE = "#0050e9";

/**
 * VERTUOZA wordmark in ANSI Shadow block letters. Drawn with box-drawing glyphs;
 * each line gets wrapped in the brand blue by `renderBanner`.
 */
const WORDMARK = [
  "██╗   ██╗███████╗██████╗ ████████╗██╗   ██╗ ██████╗ ███████╗ █████╗ ",
  "██║   ██║██╔════╝██╔══██╗╚══██╔══╝██║   ██║██╔═══██╗╚══███╔╝██╔══██╗",
  "██║   ██║█████╗  ██████╔╝   ██║   ██║   ██║██║   ██║  ███╔╝ ███████║",
  "╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║   ██║   ██║██║   ██║ ███╔╝  ██╔══██║",
  " ╚████╔╝ ███████╗██║  ██║   ██║   ╚██████╔╝╚██████╔╝███████╗██║  ██║",
  "  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝",
];

const TAGLINE = "shared Claude Code skills";

/**
 * Render the startup banner: the VERTUOZA wordmark in solid Vertuoza blue, with a
 * plain tagline beneath it.
 *
 * Pass a chalk instance to control coloring deterministically — chalk auto-detects
 * terminal support (honoring NO_COLOR / FORCE_COLOR / TTY) when the default is used, and
 * tests can force a level with `new Chalk({ level })`.
 */
export function renderBanner(c: ChalkInstance = chalk): string {
  const blue = c.hex(BRAND_BLUE);
  const lines = WORDMARK.map((line) => blue(line));
  lines.push("", `  ${TAGLINE}`);
  return lines.join("\n");
}
