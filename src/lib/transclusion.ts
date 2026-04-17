// Parse embed references `![[note]]`, `![[note#heading]]`, `![[note^block]]`
// from note bodies. The render layer fetches the target and extracts the
// relevant slice.

export interface Embed {
  raw: string;
  target: string;
  heading?: string;
  blockId?: string;
  line: number;
}

const EMBED_RE = /!\[\[([^\]\n]+)\]\]/g;

export function parseEmbeds(body: string): Embed[] {
  const out: Embed[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    EMBED_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EMBED_RE.exec(line)) !== null) {
      const inner = m[1].trim();
      let target = inner;
      let heading: string | undefined;
      let blockId: string | undefined;
      const hashIdx = inner.indexOf("#");
      const caretIdx = inner.indexOf("^");
      if (hashIdx !== -1) {
        target = inner.slice(0, hashIdx).trim();
        heading = inner.slice(hashIdx + 1).trim();
      } else if (caretIdx !== -1) {
        target = inner.slice(0, caretIdx).trim();
        blockId = inner.slice(caretIdx + 1).trim();
      }
      out.push({ raw: m[0], target, heading, blockId, line: i });
    }
  }
  return out;
}

export function extractHeadingSection(body: string, heading: string): string {
  const lines = body.split("\n");
  const target = heading.trim().toLowerCase();
  let start = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m && m[2].trim().toLowerCase() === target) {
      start = i + 1;
      startLevel = m[1].length;
      break;
    }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= startLevel) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function extractBlock(body: string, blockId: string): string {
  // Block anchors live at the end of a paragraph: `… text ^block-id`.
  const marker = "^" + blockId;
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd().endsWith(marker)) {
      let start = i;
      while (start > 0 && lines[start - 1].trim() !== "") start--;
      return lines.slice(start, i + 1).join("\n").replace(marker, "").trim();
    }
  }
  return "";
}

export function resolveEmbed(embed: Embed, body: string): string {
  if (embed.heading) return extractHeadingSection(body, embed.heading);
  if (embed.blockId) return extractBlock(body, embed.blockId);
  return body.trim();
}
