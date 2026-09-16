import { NextResponse } from "next/server";
import { GOLDEN_LEARN, isGoldenTopic } from "@/lib/golden-path";
import { learnFromAmass } from "@/lib/live-learn";
import type { LearnResult } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { topic?: string; forceLive?: boolean };
  const topic = (body.topic ?? "").trim();
  if (!topic) {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  const key = process.env.AMASS_API_KEY;
  const wantLive = Boolean(key) && (body.forceLive || !isGoldenTopic(topic));

  if (!wantLive) {
    const result: LearnResult = {
      ...GOLDEN_LEARN,
      topic,
      queryUsed: topic,
    };
    return NextResponse.json(result);
  }

  try {
    const live = await learnFromAmass(topic, key as string);
    const result: LearnResult = {
      topic,
      queryUsed: topic,
      cached: false,
      liveAmass: true,
      milestones: live.milestones,
      protein: live.protein,
    };
    return NextResponse.json(result);
  } catch (err) {
    const result: LearnResult = {
      ...GOLDEN_LEARN,
      topic,
      queryUsed: topic,
      cached: true,
      liveAmass: false,
    };
    return NextResponse.json({
      ...result,
      fallbackReason: err instanceof Error ? err.message : "amass_failed",
    });
  }
}
