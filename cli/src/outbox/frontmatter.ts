/**
 * Split a `---` front-matter block from a Markdown body.
 *
 * Plain `key: value` lines, not YAML: the inbox and outbox formats are read by
 * people and by grep as often as by this code, and a subset nobody can get
 * wrong beats a full grammar nobody reads.
 */
export type FrontMatter = { fields: Record<string, string>; body: string };

export function splitFrontMatter(text: string): FrontMatter | { error: string } {
  const normal = text.replace(/\r\n/g, "\n");
  if (!normal.startsWith("---\n")) {
    return { error: "does not open with a --- front matter line" };
  }
  const rest = normal.slice(4);
  const close = /(^|\n)---(\n|$)/.exec(rest);
  if (!close) return { error: "front matter is never closed with ---" };

  const fields: Record<string, string> = {};
  for (const raw of rest.slice(0, close.index).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const pair = /^([a-z][a-z-]*):\s*(.*)$/.exec(line);
    if (!pair) return { error: `front matter line is not "key: value": ${line}` };
    fields[pair[1]!] = pair[2]!.trim();
  }
  return { fields, body: rest.slice(close.index + close[0].length) };
}
