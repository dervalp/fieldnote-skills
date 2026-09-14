import { checkbox, input, select, confirm, Separator } from "@inquirer/prompts";
import type { Prompter } from "./types.js";
import { UserError } from "./types.js";

/** Real prompter backed by @inquirer/prompts. Requires an interactive TTY. */
export class InquirerPrompter implements Prompter {
  private requireTty(): void {
    if (!process.stdin.isTTY) {
      throw new UserError(
        "This command is interactive and needs a terminal. " +
          "In scripts/CI use the non-interactive form (e.g. `install <name> --yes`).",
      );
    }
  }

  async checkbox(opts: {
    message: string;
    choices: { name: string; value: string; checked?: boolean; disabled?: boolean }[];
  }): Promise<string[]> {
    this.requireTty();
    const choices = opts.choices.map((c) =>
      c.disabled ? new Separator(c.name) : { name: c.name, value: c.value, checked: c.checked },
    );
    return checkbox({
      message: opts.message,
      choices,
      pageSize: 20,
      theme: {
        icon: {
          checked: " ●",
          unchecked: " ○",
        },
      },
    });
  }

  async input(opts: { message: string; validate?: (value: string) => true | string }): Promise<string> {
    this.requireTty();
    return input({ message: opts.message, validate: opts.validate });
  }

  async select(opts: { message: string; choices: { name: string; value: string }[] }): Promise<string> {
    this.requireTty();
    return select({ message: opts.message, choices: opts.choices });
  }

  async confirm(opts: { message: string; default?: boolean }): Promise<boolean> {
    this.requireTty();
    return confirm({ message: opts.message, default: opts.default });
  }
}
