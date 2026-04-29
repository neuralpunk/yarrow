// Strip the descriptive / shortcut suffix from a rail-button label so
// the expanded right rail can show just the name of each item. The
// long label is still used for the hover tooltip and `aria-label` —
// only the inline caption rendered below the icon in expanded mode
// reads from the short version.
//
// Convention in `src/lib/i18n/strings/sidebar.ts`:
//   • `" · "` separates the name from a shortcut hint
//     ("Scratchpad · ⌘⇧S", "Branch from here · ⌘⇧N").
//   • `" — "` separates the name from a one-line description
//     ("Outline — headings in this note", "Tags — browse and learn
//     what each colour means").
//
// We split on the first occurrence of either separator. Labels that
// don't carry a suffix come back unchanged (e.g. "Map", "History").
export function shortRailLabel(label: string): string {
  if (!label) return label;
  const i1 = label.indexOf(" · ");
  const i2 = label.indexOf(" — ");
  let cut = -1;
  if (i1 >= 0 && i2 >= 0) cut = Math.min(i1, i2);
  else if (i1 >= 0) cut = i1;
  else if (i2 >= 0) cut = i2;
  if (cut < 0) return label;
  return label.slice(0, cut).trim();
}
