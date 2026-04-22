import type { Extension } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";

/**
 * Markdown + the full CodeMirror language-data bundle (Python, JS, Rust,
 * Go, C, Java, Kotlin, Swift, …). The language-data chunk is the bulk of
 * the editor's JS weight — keeping it in this separate module means the
 * entire grammar pack stays code-split and only lands when the "Code
 * syntax highlighting" extra is on.
 */
export async function codeHighlightedMarkdown(): Promise<Extension> {
  const { languages } = await import("@codemirror/language-data");
  return markdown({ codeLanguages: languages });
}
