import { NextResponse } from "next/server";
import { claudeJson, evidencePack, extractiveCheck } from "@/lib/grounding";
import type { CheckResult, Milestone } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    notes?: string;
    milestones?: Milestone[];
  };
  const notes = (body.notes ?? "").trim();
  const milestones = body.milestones ?? [];
  if (!notes || milestones.length === 0) {
    return NextResponse.json({ error: "notes and milestones required" }, { status: 400 });
  }

  const fallback = extractiveCheck(notes, milestones);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json(fallback);

  const checked = await claudeJson<CheckResult>(
    `Compare learner notes to the evidence pack. Return JSON only: {"covered":["..."],"gaps":["..."],"question":"...","model":"claude"}. Gaps must be facts present in the records but missing or wrong in the notes. Pose one comprehension question that requires a specific record. Do not invent facts.`,
    `Notes:\n${notes}\n\nRecords:\n${evidencePack(milestones)}`,
    key,
  );

  if (!checked?.question) return NextResponse.json(fallback);
  return NextResponse.json({
    covered: checked.covered ?? [],
    gaps: checked.gaps ?? [],
    question: checked.question,
    model: "claude",
  } satisfies CheckResult);
}
