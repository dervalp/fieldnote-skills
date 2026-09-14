export interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(["category", "orchestrator"]);
const ALIASES: Record<string, string> = { y: "yes", h: "help" };

/**
 * Minimal argv parser. First positional is the command (default "list").
 * Boolean flags (`--yes`, `--json`); value flags (`--category engineer`).
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      if (VALUE_FLAGS.has(key)) {
        flags[key] = argv[++i] ?? "";
      } else if (key.includes("=")) {
        const [k, v] = key.split("=", 2);
        flags[k!] = v ?? "";
      } else {
        flags[key] = true;
      }
    } else if (token.startsWith("-") && token.length > 1) {
      const key = ALIASES[token.slice(1)] ?? token.slice(1);
      flags[key] = true;
    } else {
      positionals.push(token);
    }
  }

  const command = positionals.shift() ?? "list";
  return { command, positionals, flags };
}
