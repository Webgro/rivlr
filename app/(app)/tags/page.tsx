import { TAG_COLOR_NAMES, type TagColor } from "@/lib/db";
import { getAllTagsWithMeta, createTag, setTagColor, deleteTag } from "./actions";
import { TagChip, TAG_COLOURS } from "@/components/tag-chip";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await getAllTagsWithMeta();

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-muted">
          Organise tracked products with colour-coded labels. Apply tags from
          the dashboard's bulk action bar.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-default bg-elevated p-5">
        <h2 className="text-xs uppercase tracking-wider text-muted font-mono">
          Create tag
        </h2>
        <form action={createTag} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            name="name"
            placeholder="tag-name"
            required
            maxLength={32}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
          />
          <ColourPicker name="color" defaultValue="gray" />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
          >
            Create
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-muted font-mono mb-3">
          {tags.length} tag{tags.length === 1 ? "" : "s"}
        </h2>
        {tags.length === 0 ? (
          <div className="rounded-lg border border-dashed border-default px-8 py-10 text-center text-sm text-muted">
            No tags yet. Create one above.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-default">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-default bg-elevated px-5 py-3 text-[11px] uppercase tracking-wider text-muted font-mono">
              <div>Tag</div>
              <div>Colour</div>
              <div className="text-right">Used by</div>
              <div className="text-right">Actions</div>
            </div>
            {tags.map((t) => (
              <div
                key={t.name}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-default px-5 py-3 last:border-b-0"
              >
                <div>
                  <TagChip name={t.name} color={t.color} size="md" />
                </div>
                <form action={setTagColor} className="flex items-center gap-2">
                  <input type="hidden" name="name" value={t.name} />
                  <ColourPicker name="color" defaultValue={t.color} />
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-foreground font-mono"
                  >
                    Save
                  </button>
                </form>
                <div className="text-right text-sm font-mono text-muted-strong">
                  {t.usage} product{t.usage === 1 ? "" : "s"}
                </div>
                <form action={deleteTag} className="text-right">
                  <input type="hidden" name="name" value={t.name} />
                  <button
                    type="submit"
                    className="rounded-md border border-signal/40 bg-signal/5 px-2 py-1 text-xs text-signal hover:border-signal hover:bg-signal/10"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ColourPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: TagColor;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {TAG_COLOR_NAMES.map((c, i) => (
        <label key={c} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={c}
            defaultChecked={i === 0 ? c === defaultValue : c === defaultValue}
            className="sr-only peer"
          />
          <span
            title={c}
            className="block h-5 w-5 rounded-full border-2 border-transparent peer-checked:border-foreground peer-checked:scale-110 transition"
            style={{
              backgroundColor: TAG_COLOURS[c].bg,
              outline: `1px solid ${TAG_COLOURS[c].border}`,
            }}
          />
        </label>
      ))}
    </div>
  );
}
