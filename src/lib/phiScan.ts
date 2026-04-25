// PHI / PII pattern scanner (2.1, advisory).
//
// Runs purely in the browser — no IPC, no upload — so a clinical note
// being edited never leaves the user's machine just to be checked. The
// scanner is deliberately conservative: false positives are far less
// expensive than false negatives in this domain, but a flood of fake
// hits would also undermine trust in the warning. Each pattern is
// tuned to the canonical shape and ignores plausible non-PHI variants
// (e.g. "ID" inside a code identifier).
//
// What this is NOT: a HIPAA-grade de-identification tool. It catches
// the obvious accidents — pasted addresses, full DOBs, raw SSNs — that
// an exhausted intern is most likely to leave in. The supervisor and
// the writer remain the readers of last resort.

export type PhiKind =
  | "ssn"
  | "dob"
  | "phone"
  | "email"
  | "address"
  | "mrn"
  | "fullname";

export interface PhiMatch {
  kind: PhiKind;
  /** Absolute character offset into the body. */
  from: number;
  /** Exclusive end offset. */
  to: number;
  /** The raw matched text — useful for the modal listing. */
  text: string;
  /** 1-based line number for the banner / modal. */
  line: number;
}

interface Pattern {
  kind: PhiKind;
  re: RegExp;
  /** Optional post-match filter — used to drop false positives that
   *  the regex alone can't easily exclude (e.g. URLs that look like
   *  email addresses). */
  reject?: (match: RegExpExecArray, fullText: string) => boolean;
}

const PATTERNS: Pattern[] = [
  // SSN: ###-##-####. We don't try to validate ranges (real SSN
  // validation is brittle); shape match is enough for "looks like a
  // social, double-check before you save."
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },

  // DOB-shaped dates: 4/15/1995, 04-15-95, 04/15/1995. Reject obvious
  // session dates by requiring it not to follow "session" or precede
  // "session"; clinical notes legitimately reference today's date and
  // those shouldn't trip the scanner.
  {
    kind: "dob",
    re: /\b(?:0?[1-9]|1[0-2])[\/\-.](?:0?[1-9]|[12]\d|3[01])[\/\-.](?:19|20)?\d{2}\b/g,
    reject: (m, text) => {
      const around = text
        .slice(Math.max(0, m.index - 24), m.index + m[0].length + 24)
        .toLowerCase();
      // "session date", "today's date" — not PHI in a session note.
      // "DOB" / "born" / "birthday" / "d.o.b" — definitely PHI.
      if (/\b(d\.?o\.?b|born|birth|birthday)\b/.test(around)) return false;
      if (/\b(session|today|appt|appointment|visit|seen)\b/.test(around)) return true;
      // Bare date at line start with no DOB/birthday keyword nearby
      // and no session keyword either: ambiguous. Flag on the side of
      // caution so a stray DOB doesn't slip through.
      return false;
    },
  },

  // Phone: (NNN) NNN-NNNN, NNN-NNN-NNNN, NNN.NNN.NNNN, +1 NNN NNN NNNN.
  {
    kind: "phone",
    re: /\b(?:\+?1[\s\-.]?)?(?:\(\d{3}\)\s?|\d{3}[\s\-.])\d{3}[\s\-.]\d{4}\b/g,
  },

  // Email — a real shape check, not the kitchen-sink RFC monster. We
  // skip if the surrounding text looks like a citation URL.
  {
    kind: "email",
    re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    reject: (m, text) => {
      const before = text.slice(Math.max(0, m.index - 8), m.index);
      // mailto: prefixes that came from a copy-paste of a citation
      // are still PHI-shaped — don't reject those. But if the match
      // is part of a URL (`https://example.com/u@x` slug), skip.
      return /https?:\/\/[\S]*$/.test(before);
    },
  },

  // Street address: digit + street name + suffix. Loose by design —
  // any number followed by a word and a known suffix flags. False
  // positives are visible in the highlight but rarely catastrophic.
  {
    kind: "address",
    re: /\b\d+\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Place|Pl\.?|Highway|Hwy\.?|Parkway|Pkwy\.?)\b/g,
  },

  // Medical record number patterns. "MRN: 12345", "MR# 12345",
  // "Patient ID 12345". Pure-word patient/MRN tokens with no numbers
  // following are not flagged — that's just how a writer talks about
  // the abstract concept.
  {
    kind: "mrn",
    re: /\b(?:MRN|MR#|Patient\s+ID|Patient\s+Number|Account\s+#)[\s:#]*\d{3,}\b/gi,
  },
];

// Optional fullname pass — far more prone to false positives so it's
// run separately and tagged distinctly. Two-word capitalized sequences
// are flagged ONLY when adjacent to a "client", "patient", "Mr/Ms/Mrs",
// or "Dr." token. That gives us "Mr. John Smith" or "the client, Jane
// Doe" while skipping prose like "John Bowlby's attachment theory."
const FULLNAME_RE =
  /(?:\b(?:Mr|Ms|Mrs|Mx|Dr|Prof|Patient|Client)\.?\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;

// Collect raw matches without line numbers so the line-numbering pass
// at the end can run in a single linear sweep. The previous version
// called `lineFor(text, m.index)` per match — each call scanned from
// 0 to `m.index`, so a long clinical note with many matches was O(n²)
// in document length. On a 50KB note with ~80 hits the scan would tie
// up the main thread for tens of milliseconds; the new pass-based
// approach is linear in document length regardless of match count.
type RawMatch = Omit<PhiMatch, "line">;

function scanFullname(text: string): RawMatch[] {
  const out: RawMatch[] = [];
  FULLNAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FULLNAME_RE.exec(text)) !== null) {
    const around = text.slice(Math.max(0, m.index - 32), m.index).toLowerCase();
    const isClinicalContext =
      /(?:^|\s)(?:client|patient|seen|treating|treats|treated|presenting|brought\s+by|accompanied\s+by|named|met\s+with)\b[\s,:]*$/.test(
        around,
      ) ||
      /^(?:Mr|Ms|Mrs|Mx|Dr|Prof|Patient|Client)\.?\s+/.test(m[0]);
    if (!isClinicalContext) continue;
    out.push({
      kind: "fullname",
      from: m.index,
      to: m.index + m[0].length,
      text: m[0],
    });
  }
  return out;
}

/** Walk `text` once and stamp `line` onto each match. Matches must be
 *  pre-sorted by `from`. Linear in `text.length + matches.length`. */
function annotateLines(text: string, matches: RawMatch[]): PhiMatch[] {
  const out: PhiMatch[] = new Array(matches.length);
  let line = 1;
  let textIdx = 0;
  for (let mi = 0; mi < matches.length; mi++) {
    const m = matches[mi];
    while (textIdx < m.from && textIdx < text.length) {
      if (text.charCodeAt(textIdx) === 0x0a) line++;
      textIdx++;
    }
    out[mi] = { ...m, line };
  }
  return out;
}

export function scanForPhi(text: string): PhiMatch[] {
  if (!text) return [];
  const raw: RawMatch[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      if (p.reject && p.reject(m, text)) continue;
      raw.push({
        kind: p.kind,
        from: m.index,
        to: m.index + m[0].length,
        text: m[0],
      });
    }
  }
  raw.push(...scanFullname(text));
  raw.sort((a, b) => a.from - b.from || a.to - b.to);
  return annotateLines(text, raw);
}

export const PHI_KIND_LABEL: Record<PhiKind, string> = {
  ssn: "SSN",
  dob: "Date of birth",
  phone: "Phone number",
  email: "Email address",
  address: "Street address",
  mrn: "Medical record / patient ID",
  fullname: "Possible full name",
};
