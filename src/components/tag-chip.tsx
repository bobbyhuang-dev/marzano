import { readableTextColor, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

const CHIP_SIZES = {
  sm: "h-[1.375rem] max-w-[9rem] px-2 text-[0.6875rem]",
  md: "h-7 max-w-[12rem] px-2.5 text-xs",
  lg: "h-9 max-w-full px-4 text-sm",
} as const;

interface TagChipProps {
  tag: Tag;
  size?: keyof typeof CHIP_SIZES;
  className?: string;
}

/**
 * A tag as it appears everywhere: a fully rounded pill filled with the tag
 * colour, labelled in whichever of black or white the fill carries better.
 * Long names truncate rather than stretch the row they sit in.
 */
function TagChip({ tag, size = "sm", className }: TagChipProps) {
  return (
    <span
      title={tag.name}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold leading-none",
        CHIP_SIZES[size],
        className,
      )}
      style={{
        backgroundColor: tag.color,
        color: readableTextColor(tag.color),
      }}
    >
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** The tags on a task, sitting to the right of its date until they wrap. */
function TagChipList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="Tags" className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <li key={tag.id} className="flex">
          <TagChip tag={tag} />
        </li>
      ))}
    </ul>
  );
}

/** The colour alone, for rows where the name is already spelled out beside it. */
function TagSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-3 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export { TagChip, TagChipList, TagSwatch };
