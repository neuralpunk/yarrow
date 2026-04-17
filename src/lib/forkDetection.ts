const FORK_PREFIXES = [
  "but ",
  "however,",
  "however ",
  "on the other hand",
  "then again",
  "although ",
  "conversely",
  "alternatively",
  "yet ",
  "and yet",
  "that said,",
  "that said ",
  "counterpoint:",
  "counterargument:",
  "or maybe",
  "or perhaps",
  "though ",
];

const MIN_LENGTH = 60;

export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function divergentParagraphs(body: string): string[] {
  return paragraphsOf(body).filter(isDivergent);
}

export function isDivergent(paragraph: string): boolean {
  const t = paragraph.trim().toLowerCase();
  if (t.length < MIN_LENGTH) return false;
  return FORK_PREFIXES.some((p) => t.startsWith(p));
}

export interface OpenQuestion {
  text: string;
  line: number;
}

export function openQuestions(body: string): OpenQuestion[] {
  const out: OpenQuestion[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\?\?\s*(.*)$/);
    if (m && m[1] && m[1].trim().length > 0) {
      out.push({ text: m[1].trim(), line: i + 1 });
    }
  }
  return out;
}
