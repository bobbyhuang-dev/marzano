import { ChevronRight, ListTodo, PencilLine, Plus, Tag as TagIcon } from "lucide-react";

import { DeleteTagDialog } from "@/components/delete-tag-dialog";
import { EmptyPanel } from "@/components/empty-panel";
import { TagChip } from "@/components/tag-chip";
import { TagFormDialog, type TagValues } from "@/components/tag-form-dialog";
import { TaskList } from "@/components/task-list";
import { type TaskChanges } from "@/components/task-form-dialog";
import { Button } from "@/components/ui/button";
import { isActiveTask, type TagTaskCount, type Task } from "@/lib/tasks";
import { byTagName, tagColorName, tagTint, type Tag } from "@/lib/tags";

function countLabel(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

interface TagActionsProps {
  tag: Tag;
  tags: Tag[];
  count: TagTaskCount;
  onUpdateTag: (tagId: string, values: TagValues) => void;
  onDeleteTag: (tag: Tag) => void;
}

/** Edit and delete, identical on the list row and on the tag's own page. */
function TagActions({
  tag,
  tags,
  count,
  onUpdateTag,
  onDeleteTag,
}: TagActionsProps) {
  return (
    <>
      <TagFormDialog
        tags={tags}
        tag={tag}
        onSubmit={(values) => onUpdateTag(tag.id, values)}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${tag.name}`}
            title="Edit tag"
          >
            <PencilLine aria-hidden="true" />
          </Button>
        }
      />
      <DeleteTagDialog
        tag={tag}
        taskCount={count.total}
        onDelete={() => onDeleteTag(tag)}
      />
    </>
  );
}

interface TagsPageProps {
  tags: Tag[];
  counts: Map<string, TagTaskCount>;
  onOpenTag: (tagId: string) => void;
  onCreateTag: (values: TagValues) => Tag;
  onUpdateTag: (tagId: string, values: TagValues) => void;
  onDeleteTag: (tag: Tag) => void;
}

/** The list of every tag, built like the task page: make one, then see them all. */
function TagsPage({
  tags,
  counts,
  onOpenTag,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: TagsPageProps) {
  const sorted = [...tags].sort(byTagName);

  return (
    <>
      <div className="grid gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            Create a tag
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Group tasks by subject, then find them together later.
          </p>
        </div>
        <TagFormDialog
          tags={tags}
          onSubmit={onCreateTag}
          trigger={
            <Button className="w-full sm:w-auto">
              <Plus aria-hidden="true" />
              New tag
            </Button>
          }
        />
      </div>

      <section className="mt-8" aria-labelledby="tags-heading">
        <h2
          id="tags-heading"
          className="mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground"
        >
          Your tags
        </h2>
        <div>
          {sorted.length === 0 ? (
            <EmptyPanel
              icon={TagIcon}
              title="No tags yet"
              description="Create your first tag above, then add it to any task."
            />
          ) : (
            <ul className="-mt-2 divide-y divide-border" aria-label="Tag list">
              {sorted.map((tag) => {
                const count = counts.get(tag.id) ?? { open: 0, total: 0 };

                return (
                  <li
                    key={tag.id}
                    className="flex items-center gap-1 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTag(tag.id)}
                      className="group -ml-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left transition-ui hover:bg-accent/60 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70 sm:-ml-3 sm:px-3"
                    >
                      <TagChip tag={tag} size="md" />
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {countLabel(count.open, "task")}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto size-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                    <TagActions
                      tag={tag}
                      tags={tags}
                      count={count}
                      onUpdateTag={onUpdateTag}
                      onDeleteTag={onDeleteTag}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

interface TagDetailPageProps {
  tag: Tag;
  tags: Tag[];
  tasks: Task[];
  tagsById: Map<string, Tag>;
  counts: Map<string, TagTaskCount>;
  onUpdateTag: (tagId: string, values: TagValues) => void;
  onDeleteTag: (tag: Tag) => void;
  onCreateTag: (values: TagValues) => Tag;
  onCompleteTask: (task: Task) => void;
  onSaveTask: (task: Task, changes: TaskChanges) => void;
  onDeleteTask: (task: Task) => void;
}

/** One tag: what it looks like, what it holds, and the same task list as ever. */
function TagDetailPage({
  tag,
  tags,
  tasks,
  tagsById,
  counts,
  onUpdateTag,
  onDeleteTag,
  onCreateTag,
  onCompleteTask,
  onSaveTask,
  onDeleteTask,
}: TagDetailPageProps) {
  const count = counts.get(tag.id) ?? { open: 0, total: 0 };
  const tagged = tasks.filter(
    (task) => task.tagIds.includes(tag.id) && isActiveTask(task),
  );
  const completed = count.total - count.open;

  return (
    <>
      <div
        className="rounded-lg p-5 sm:p-6"
        // A wash of the tag's own colour, so the page is recognisable before a
        // word of it is read.
        style={{ backgroundColor: tagTint(tag.color, 0.07) }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <TagChip tag={tag} size="lg" />
            <p className="mt-2.5 text-sm text-muted-foreground">
              {tagColorName(tag.color)}
              <span aria-hidden="true" className="px-1.5">
                ·
              </span>
              {countLabel(count.open, "open task")}
              {completed > 0 ? (
                <>
                  <span aria-hidden="true" className="px-1.5">
                    ·
                  </span>
                  {completed} completed
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <TagActions
              tag={tag}
              tags={tags}
              count={count}
              onUpdateTag={onUpdateTag}
              onDeleteTag={onDeleteTag}
            />
          </div>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="tag-tasks-heading">
        <h2
          id="tag-tasks-heading"
          className="mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground"
        >
          Tasks with this tag
        </h2>
        <TaskList
          tasks={tagged}
          tags={tags}
          tagsById={tagsById}
          label={`Tasks tagged ${tag.name}`}
          empty={
            <EmptyPanel
              icon={ListTodo}
              title="Nothing here yet"
              description={`Add “${tag.name}” to a task and it shows up on this page.`}
            />
          }
          onComplete={onCompleteTask}
          onSave={onSaveTask}
          onDelete={onDeleteTask}
          onCreateTag={onCreateTag}
        />
      </section>
    </>
  );
}

export { TagDetailPage, TagsPage };
