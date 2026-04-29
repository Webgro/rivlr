import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getLinkCandidates } from "@/app/(app)/products/[id]/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const candidates = await getLinkCandidates(id, 30);
  return NextResponse.json({ candidates });
}
