import { NextResponse } from "next/server";
import { claudeJson, evidencePack, extractiveTeach } from "@/lib/grounding";
import type { Milestone, TeachResult } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    question?: string;
    milestones?: Milestone[];
  };
  const question = (body.question ?? "").trim();
  const milestones = body.milestones ?? [];
  if (!question || milestones.length === 0) {
    return NextResponse.json({ error: "question and milestones required" }, { status: 400 });
  }

  const fallback = extractiveTeach(question, milestones);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json(fallback);

  const taught = await claudeJson<TeachResult>(
    `You are a life-science tutor. You may ONLY use the provided Amass records. If the records do not contain the answer, say so. Return JSON: {"answer": "...", "citedIds": ["..."], "model": "claude"}. Cite by record id. Plain language for a smart non-expert. No extra keys.`,
    `Question: ${question}\n\nRecords:\n${evidencePack(milestones)}`,
    key,
  );

  if (!taught?.answer) return NextResponse.json(fallback);
  const allowed = new Set(milestones.map((m) => m.id));
  const citedIds = (taught.citedIds ?? []).filter((id) => allowed.has(id));
  return NextResponse.json({
    answer: taught.answer,
    citedIds: citedIds.length ? citedIds : fallback.citedIds,
    model: "claude",
  } satisfies TeachResult);
}
