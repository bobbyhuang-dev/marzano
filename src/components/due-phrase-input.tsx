import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
} from "react";

import { Input } from "@/components/ui/input";
import { type DuePhraseMatch } from "@/lib/due-phrase";
import { type TagMention } from "@/lib/tag-mention";
import { formatDueDate } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface DuePhraseInputProps extends Omit<ComponentProps<"input">, "value"> {
  value: string;
  /** The words the due date was read from, boxed inside the field. */
  phrase: DuePhraseMatch | null;
  /** The "#" and the tag name being typed after it, boxed the same way. */
  mention?: TagMention | null;
  /** Anything anchored to the field, such as the tag list under a mention. */
  children?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

interface Box {
  start: number;
  end: number;
  className: string;
}

const PHRASE_BOX = "rounded-xs bg-primary/15 shadow-[0_0_0_2px] shadow-primary/15";
const MENTION_BOX = "rounded-xs bg-foreground/10 shadow-[0_0_0_2px] shadow-foreground/10";

/**
 * The boxes in order, never overlapping: "#tmr" reads as a mention first, and
 * the date it might also be waits until the words are back to being words.
 */
function boxes(phrase: DuePhraseMatch | null, mention: TagMention | null | undefined): Box[] {
  const found: Box[] = [];
  if (mention) found.push({ ...mention, className: MENTION_BOX });
  if (phrase && !found.some((box) => phrase.start < box.end && box.start < phrase.end))
    found.push({ ...phrase, className: PHRASE_BOX });
  return found.sort((a, b) => a.start - b.start);
}

/**
 * A task-name field that boxes the words its due date was read from. A plain
 * `<input>` cannot colour part of its own text, so a copy of the text sits over
 * the field in the same font and padding, invisible except for the tint on the
 * phrase; the input underneath keeps the caret, the selection and the typing.
 * The copy follows the field's horizontal scroll so the box stays on its words.
 */
function DuePhraseInput({
  value,
  phrase,
  mention,
  children,
  className,
  ref,
  onScroll,
  ...props
}: DuePhraseInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const hintId = useId();

  const follow = useCallback(() => {
    if (mirrorRef.current && inputRef.current)
      mirrorRef.current.style.transform = `translateX(${-inputRef.current.scrollLeft}px)`;
  }, []);

  // Typing at the far end scrolls the field before any scroll event lands.
  useLayoutEffect(() => follow(), [follow, value, phrase, mention]);

  const drawn = boxes(phrase, mention);
  const segments: ReactNode[] = [];
  let cursor = 0;
  for (const box of drawn) {
    segments.push(value.slice(cursor, box.start));
    segments.push(
      <span key={box.start} className={cn(box.className, "animate-fade-in")}>
        {value.slice(box.start, box.end)}
      </span>,
    );
    cursor = box.end;
  }
  segments.push(value.slice(cursor));

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const describedBy =
    [props["aria-describedby"], phrase ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="relative">
      <Input
        {...props}
        ref={setRefs}
        value={value}
        className={className}
        aria-describedby={describedBy}
        onScroll={(event) => {
          follow();
          onScroll?.(event);
        }}
      />
      {drawn.length > 0 ? (
        <div
          aria-hidden="true"
          // Inset by the border and clipped like the field, with the same
          // gutter, so the copy lands on the text to the pixel.
          className="pointer-events-none absolute inset-px flex items-center overflow-hidden rounded-[calc(var(--radius-md)-1px)] px-3 text-sm whitespace-pre text-transparent"
        >
          <span ref={mirrorRef} className="shrink-0">
            {segments}
          </span>
        </div>
      ) : null}
      {phrase ? (
        <span id={hintId} className="sr-only">
          Due {formatDueDate(phrase.dueAt)}, read from “{phrase.text}”. Delete
          those words to remove the due date, or pick a date to keep them as
          part of the name.
        </span>
      ) : null}
      {children}
    </div>
  );
}

export { DuePhraseInput };
