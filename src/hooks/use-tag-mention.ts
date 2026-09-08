import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  type SyntheticEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  completeTagMention,
  findTagMention,
  matchTags,
  removeTagMention,
  tagAcceptedBySpace,
  type TagMention,
} from "@/lib/tag-mention";
import type { Tag } from "@/lib/tags";

interface UseTagMentionOptions {
  tags: Tag[];
  value: string;
  onValueChange: (value: string) => void;
  /** The tag the reader settled on; the words that named it are already gone. */
  onPick: (tag: Tag) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export interface TagMentionField {
  /** The "#" and its words at the caret, boxed in the field. */
  mention: TagMention | null;
  /** The list is showing: there is a mention and it has not been waved off. */
  open: boolean;
  matches: Tag[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  menuId: string;
  optionId: (tag: Tag) => string;
  pick: (tag: Tag) => void;
  inputProps: {
    role: "combobox";
    "aria-autocomplete": "list";
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
    "aria-activedescendant": string | undefined;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onSelect: (event: SyntheticEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
}

/**
 * Typing "#" in a task name opens the tags. The mention is read back out of
 * the text and the caret each time either moves, so there is nothing to keep
 * in step with the field; the only memory is which "#" was waved off with
 * Escape, and that lasts until the "#" itself is deleted or typed again.
 * Picking a tag takes the words out of the name and hands the tag up, so the
 * name never has to carry it.
 */
export function useTagMention({
  tags,
  value,
  onValueChange,
  onPick,
  inputRef,
}: UseTagMentionOptions): TagMentionField {
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingCaret = useRef<number | null>(null);
  const menuId = useId();

  const mention = findTagMention(value, caret, tags);
  const dismissed = mention !== null && mention.start === dismissedStart;
  const open = focused && mention !== null && !dismissed;
  const matches = open ? matchTags(tags, mention.query) : [];
  const active = Math.min(activeIndex, Math.max(matches.length - 1, 0));

  // The caret is placed after React has written the shorter value, or the
  // browser would put it at the end.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null || !inputRef.current) return;
    pendingCaret.current = null;
    inputRef.current.setSelectionRange(at, at);
    setCaret(at);
  }, [value, inputRef]);

  const settle = (tag: Tag, text: string, at: TagMention) => {
    const next = removeTagMention(text, at);
    pendingCaret.current = next.caret;
    onValueChange(next.text);
    onPick(tag);
    setActiveIndex(0);
  };

  const pick = (tag: Tag) => {
    if (mention) settle(tag, value, mention);
  };

  const optionId = (tag: Tag) => `${menuId}-${tag.id}`;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const at = event.target.selectionStart ?? next.length;

    // A space right after a name that is exactly a tag's settles on that tag,
    // as it would with Enter, so a name typed out in full needs no list.
    if (next.length === value.length + 1 && next[at - 1] === " ") {
      const typed = findTagMention(value, at - 1, tags);
      const tag = typed && typed.start !== dismissedStart
        ? tagAcceptedBySpace(tags, typed.query)
        : null;
      if (tag && typed) {
        settle(tag, value, typed);
        return;
      }
    }

    // A "#" typed fresh is a new mention even where one was waved off.
    if (dismissedStart !== null && (next[dismissedStart] !== "#" || next[at - 1] === "#"))
      setDismissedStart(null);
    setActiveIndex(0);
    setCaret(at);
    onValueChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !mention) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (matches.length === 0) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((active + step + matches.length) % matches.length);
        return;
      }
      case "Enter": {
        if (matches.length === 0) return;
        event.preventDefault();
        pick(matches[active]);
        return;
      }
      case "Tab": {
        // Tab fills the name in and leaves the list open; a name already
        // complete is taken as chosen, so Tab twice is the same as Enter.
        if (matches.length === 0) return;
        event.preventDefault();
        const tag = matches[active];
        if (mention.query === tag.name) {
          pick(tag);
          return;
        }
        const next = completeTagMention(value, mention, tag);
        pendingCaret.current = next.caret;
        onValueChange(next.text);
        return;
      }
      case "Escape": {
        // Kept from the dialog around the field, which would close on it.
        event.preventDefault();
        event.stopPropagation();
        setDismissedStart(mention.start);
        return;
      }
    }
  };

  return {
    mention: dismissed ? null : mention,
    open,
    matches,
    activeIndex: active,
    setActiveIndex,
    menuId,
    optionId,
    pick,
    inputProps: {
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": open,
      "aria-controls": open ? menuId : undefined,
      "aria-activedescendant":
        open && matches.length > 0 ? optionId(matches[active]) : undefined,
      onChange,
      onKeyDown,
      onSelect: (event) => setCaret(event.currentTarget.selectionStart ?? 0),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
