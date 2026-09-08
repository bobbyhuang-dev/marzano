import { AnimatePresence, motion } from "motion/react";

import { TagSwatch } from "@/components/tag-chip";
import type { TagMentionField } from "@/hooks/use-tag-mention";
import { popoverMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The tags a "#" in the name could mean, under the field. The keyboard stays
 * in the field -- the rows are named to it through `aria-activedescendant`
 * -- so a row is a target for the pointer only, and it swallows the press
 * that would otherwise take the focus, and the list with it, away.
 */
function TagMentionMenu({ field }: { field: TagMentionField }) {
  const { open, mention, matches, activeIndex, menuId, optionId, pick, setActiveIndex } = field;

  return (
    <AnimatePresence>
      {open && mention ? (
        <motion.div
          key="mention"
          {...popoverMotion()}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,100%)] origin-top-left overflow-hidden rounded-lg bg-popover shadow-popover"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {mention.query.trim() === ""
                ? "No tags yet. Make one from the Tags chip below."
                : `No tag named “${mention.query.trim()}”.`}
            </p>
          ) : (
            <ul
              id={menuId}
              role="listbox"
              aria-label="Tags"
              className="max-h-[17rem] overflow-y-auto overscroll-contain py-1"
            >
              {matches.map((tag, index) => {
                const active = index === activeIndex;

                return (
                  <li
                    key={tag.id}
                    id={optionId(tag)}
                    role="option"
                    aria-selected={active}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => {
                      if (!active) setActiveIndex(index);
                    }}
                    onClick={() => pick(tag)}
                    className={cn(
                      "flex min-h-9 cursor-default items-center gap-2.5 px-3 text-sm text-foreground transition-ui pointer-coarse:min-h-10",
                      active && "bg-accent",
                    )}
                  >
                    <TagSwatch color={tag.color} className="size-3.5" />
                    <span title={tag.name} className="min-w-0 flex-1 truncate">
                      {tag.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { TagMentionMenu };
