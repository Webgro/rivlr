import { SuggestionsContent } from "./suggestions-content";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <SuggestionsContent />
    </section>
  );
}
