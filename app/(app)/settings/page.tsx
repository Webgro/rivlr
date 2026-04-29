import { saveNotificationEmails, getSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const current = (settings?.notificationEmails ?? []).join(", ");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Phase 1 — only notification emails for now. More settings coming as
          features land.
        </p>
      </div>

      <section className="mt-10 rounded-xl border border-default bg-elevated p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-muted">
          Notification emails
        </h2>
        <p className="mt-2 text-sm text-muted">
          Where to send stock-change and price-drop alerts. Add multiple
          addresses comma-separated. Emails actually start sending once Phase 5
          (Resend integration) lands — for now this just persists the list.
        </p>

        <form action={saveNotificationEmails} className="mt-5 space-y-3">
          <textarea
            name="emails"
            defaultValue={current}
            rows={3}
            placeholder="you@example.com, partner@example.com"
            className="block w-full rounded-md border border-default bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface"
          >
            Save
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs text-muted font-mono">
        {settings
          ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}`
          : "Not yet configured"}
      </p>
    </main>
  );
}
