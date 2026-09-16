import type { CheckResult, Milestone, TeachResult } from "./types";

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+\- ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function scoreMilestone(q: string, m: Milestone): number {
  const bag = `${m.title} ${m.summary} ${m.teach} ${m.kind}`.toLowerCase();
  let s = 0;
  for (const t of tokens(q)) {
    if (bag.includes(t)) s += 2;
  }
  if (/obes|weight|wegovy|step/.test(q.toLowerCase()) && /obes|weight|wegovy|STEP/.test(bag))
    s += 8;
  if (/diabetes|hba1c|ozempic|exenatide/.test(q.toLowerCase()) && /diabetes|exenatide|ozempic/.test(bag))
    s += 6;
  if (/heart|cardio|mace|select|sustain/.test(q.toLowerCase()) && /cardio|MACE|SELECT|SUSTAIN/i.test(bag))
    s += 8;
  if (/receptor|protein|alphafold|clon/.test(q.toLowerCase()) && m.kind === "gene") s += 6;
  return s;
}

export function extractiveTeach(
  question: string,
  milestones: Milestone[],
): TeachResult {
  const ranked = [...milestones]
    .map((m) => ({ m, s: scoreMilestone(question, m) }))
    .sort((a, b) => b.s - a.s);
  const top = ranked.filter((x) => x.s > 0).slice(0, 4).map((x) => x.m);
  const used = top.length ? top : milestones.slice(0, 3);
  const lines = used.map(
    (m) =>
      `• ${m.date.slice(0, 4)} — ${m.title}. ${m.teach} [${m.sourceLabel}]`,
  );
  return {
    model: "extractive",
    citedIds: used.map((m) => m.id),
    answer: `Grounded in ${used.length} retrieved records (no claims beyond these sources):\n\n${lines.join("\n\n")}`,
  };
}

const KEY_POINTS = [
  {
    id: "origin",
    label: "GLP-1 was predicted from the proglucagon gene in the 1980s, not invented with the drugs",
    keys: ["1980", "1983", "proglucagon", "gene", "identified", "discovered"],
  },
  {
    id: "incretin",
    label: "Human studies showed GLP-1 is an incretin (insulin up, glucagon down after meals)",
    keys: ["incretin", "insulin", "glucagon", "meal"],
  },
  {
    id: "receptor",
    label: "The receptor (GLP1R / P43220) was cloned in the early 1990s — the 3D target",
    keys: ["receptor", "cloned", "glp1r", "gpcr", "p43220", "1992"],
  },
  {
    id: "diabetes",
    label: "First medicine: exenatide (Byetta) FDA-approved 2005 for type 2 diabetes",
    keys: ["exenatide", "byetta", "2005", "diabetes"],
  },
  {
    id: "obesity",
    label: "Obesity indication rests on STEP 1 (~15% weight loss) and Wegovy approval, not just diabetes use",
    keys: ["obesity", "weight", "wegovy", "step", "15%"],
  },
  {
    id: "cv",
    label: "Cardiovascular benefit: SUSTAIN-6 (diabetes) and SELECT (obesity without diabetes)",
    keys: ["cardiovascular", "heart", "mace", "select", "sustain"],
  },
];

export function extractiveCheck(notes: string, _milestones: Milestone[]): CheckResult {
  const n = notes.toLowerCase();
  const covered: string[] = [];
  const gaps: string[] = [];
  for (const kp of KEY_POINTS) {
    const hit = kp.keys.some((k) => n.includes(k));
    (hit ? covered : gaps).push(kp.label);
  }
  const firstGap = gaps[0] ?? KEY_POINTS[0].label;
  return {
    model: "extractive",
    covered,
    gaps,
    question: `Using only the timeline, how would you explain this missing piece to a classmate: “${firstGap}”? Name the year and the clickable source you would open.`,
  };
}

export async function claudeJson<T>(
  system: string,
  user: string,
  apiKey: string,
): Promise<T | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export function evidencePack(milestones: Milestone[]): string {
  return milestones
    .map(
      (m) =>
        `[${m.id}] (${m.kind}, ${m.date}) ${m.title}\n${m.summary}\nSource: ${m.sourceLabel} ${m.sourceUrl}`,
    )
    .join("\n\n");
}
