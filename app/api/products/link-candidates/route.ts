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
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const candidates = await getLinkCandidates(id, 30, q);
  return NextResponse.json({ candidates });
}
