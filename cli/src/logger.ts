import type { Logger } from "./types.js";

/** Console logger. Decorated messages go to stderr; `output` is clean stdout. */
export class ConsoleLogger implements Logger {
  info(message: string): void {
    process.stderr.write(message + "\n");
  }
  warn(message: string): void {
    process.stderr.write(`! ${message}\n`);
  }
  error(message: string): void {
    process.stderr.write(`✗ ${message}\n`);
  }
  output(message: string): void {
    process.stdout.write(message + "\n");
  }
}
