import { byTagName, type Tag } from "@/lib/tags";

/**
 * A tag being named inside a task name: "Buy milk #gro|" is a mention of
 * every tag starting with "gro". `start` is the "#", `end` is where the word
 * stops, and the box in the field is drawn between them.
 */
export interface TagMention {
  start: number;
  end: number;
  /** What was typed after the "#", the text to match tag names against. */
  query: string;
}

function fold(text: string): string {
  return text.trim().toLowerCase();
}

/** Whether `name` could still become `query` with more typing. */
function startsWith(name: string, query: string): boolean {
  return name.toLowerCase().startsWith(query.toLowerCase());
}

/**
 * The mention the caret is in, or null. A "#" counts only at the start of a
 * word, so "C#" and "issue#12" are left alone. The mention runs to the end of
 * the word, and past a space only while some tag name still begins with the
 * words so far ("#organic chem" for "Organic chemistry"): once nothing can
 * match, the "#" and its words are ordinary text again, which is also how a
 * "#123" that was never meant as a tag gets out of the way.
 */
export function findTagMention(
  text: string,
  caret: number,
  tags: Tag[],
): TagMention | null {
  const start = text.lastIndexOf("#", caret - 1);
  if (start === -1) return null;
  if (start > 0 && !/\s/u.test(text[start - 1])) return null;

  const rest = text.slice(caret);
  const wordEnd = caret + (rest.match(/^\S*/u)?.[0].length ?? 0);
  const query = text.slice(start + 1, wordEnd);
  if (query.includes("#")) return null;
  if (/\s/u.test(query) && !tags.some((tag) => startsWith(tag.name, query)))
    return null;

  return { start, end: wordEnd, query };
}

/**
 * The tags a mention could mean, best first: the one it names exactly, then
 * those it begins, then those it appears somewhere in.
 */
export function matchTags(tags: Tag[], query: string): Tag[] {
  const needle = fold(query);
  const sorted = [...tags].sort(byTagName);
  if (!needle) return sorted;

  const rank = (tag: Tag): number => {
    const name = tag.name.toLowerCase();
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.includes(needle)) return 2;
    return 3;
  };

  return sorted
    .map((tag) => ({ tag, rank: rank(tag) }))
    .filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ tag }) => tag);
}

/**
 * The tag a space after the mention settles on: the one the words name
 * exactly, unless another tag carries on past that space ("#organic " could
 * still be "Organic chemistry"), in which case the typing is left to go on.
 */
export function tagAcceptedBySpace(tags: Tag[], query: string): Tag | null {
  const needle = fold(query);
  if (!needle) return null;
  const exact = tags.find((tag) => tag.name.toLowerCase() === needle);
  if (!exact) return null;
  const longer = tags.some(
    (tag) => tag !== exact && startsWith(tag.name, `${needle} `),
  );
  return longer ? null : exact;
}

/**
 * The name with the mention taken out and the gap closed, and where the caret
 * lands. A space is left at the end on purpose: the reader is still typing,
 * and the trailing space goes when the name is saved.
 */
export function removeTagMention(
  text: string,
  mention: Pick<TagMention, "start" | "end">,
): { text: string; caret: number } {
  const before = text.slice(0, mention.start);
  let after = text.slice(mention.end);
  if (after.startsWith(" ") && (before === "" || before.endsWith(" ")))
    after = after.slice(1);
  return { text: before + after, caret: before.length };
}

/**
 * The name with the mention's words replaced by the tag's full name, still
 * behind the "#", and the caret at its end: Tab filling in the rest, with the
 * choice itself left to Enter.
 */
export function completeTagMention(
  text: string,
  mention: Pick<TagMention, "start" | "end">,
  tag: Tag,
): { text: string; caret: number } {
  const before = `${text.slice(0, mention.start)}#${tag.name}`;
  return { text: before + text.slice(mention.end), caret: before.length };
}
