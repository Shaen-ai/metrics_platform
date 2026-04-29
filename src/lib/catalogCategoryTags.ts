/** Parse comma/newline-separated category placement tags for catalog forms. */
export function parseCommaCategoryTags(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
