import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getLinkCandidates } from "@/app/(app)/products/[id]/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const q = url.searchParams.get("q") ?? undefined;
  const store = url.searchParams.get("store") ?? undefined;
  const browseAll = url.searchParams.get("browseAll") === "1";
  const excludeOwnStore = url.searchParams.get("excludeOwnStore") === "1";

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const candidates = await getLinkCandidates(id, {
    limit: 50,
    query: q,
    store,
    browseAll,
    excludeOwnStore,
  });
  return NextResponse.json({ candidates });
}
