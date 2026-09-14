/**
 * The `vendored:` provenance block (ADR-0009). A skill whose name starts with
 * a vendor prefix is a copy of someone else's work, and must say exactly
 * whose, from which ref, and what the upstream body hashed to *before* we
 * rewrote its internal references — that pre-rewrite hash is what makes a
 * re-sync a two-value comparison instead of a merge.
 *
 * One prefix per upstream. The list is an allow-list rather than something
 * read back out of `cli/vendor/*.json`, so a typo'd manifest prefix fails at
 * import instead of quietly minting a new namespace nobody reviewed.
 */
export const VENDOR_PREFIXES = ["fieldnote-matt-", "fieldnote-superpowers-"] as const;
export type VendorPrefix = (typeof VENDOR_PREFIXES)[number];

export const REQUIRED_VENDOR_FIELDS = [
  "upstream",
  "ref",
  "commit",
  "path",
  "license",
  "licenseFile",
  "upstreamBodyHash",
] as const;

/** `fieldnote-matt-*`, `fieldnote-superpowers-*`, … — a printable list for errors. */
export const vendorPrefixList = (): string => VENDOR_PREFIXES.map((p) => `${p}*`).join(", ");

/** The prefix this name is vendored under, or undefined when first-party. */
export function vendorPrefixOf(name: string): VendorPrefix | undefined {
  return VENDOR_PREFIXES.find((prefix) => new RegExp(`^${prefix}[a-z0-9][a-z0-9-]*$`).test(name));
}

export function isVendoredName(name: string): boolean {
  return vendorPrefixOf(name) !== undefined;
}

/** True when `prefix` is one this repo vendors under. */
export function isVendorPrefix(prefix: string): prefix is VendorPrefix {
  return (VENDOR_PREFIXES as readonly string[]).includes(prefix);
}

/** Which required provenance fields are absent or blank. */
export function missingVendorFields(block: Record<string, string>): string[] {
  return REQUIRED_VENDOR_FIELDS.filter((field) => (block[field] ?? "").trim() === "");
}
