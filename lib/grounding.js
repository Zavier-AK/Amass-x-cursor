"use strict";

function tokens(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9+\- ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function scoreMilestone(q, m) {
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

function extractiveTeach(question, milestones) {
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

function extractiveCheck(notes, _milestones) {
  const n = String(notes).toLowerCase();
  const covered = [];
  const gaps = [];
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

function evidencePack(milestones) {
  return milestones
    .map(
      (m) =>
        `[${m.id}] (${m.kind}, ${m.date}) ${m.title}\n${m.summary}\nSource: ${m.sourceLabel} ${m.sourceUrl}`,
    )
    .join("\n\n");
}

async function claudeJson(system, user, apiKey) {
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
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const block = Array.isArray(data.content)
    ? data.content.find((c) => c.type === "text")
    : null;
  const text = (block && block.text) || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function teachQuestion(question, milestones, anthropicKey) {
  const fallback = extractiveTeach(question, milestones);
  if (!anthropicKey) return fallback;
  try {
    const taught = await claudeJson(
      `You are a life-science tutor. You may ONLY use the provided Amass records. If the records do not contain the answer, say so. Return JSON: {"answer": "...", "citedIds": ["..."], "model": "claude"}. Cite by record id. Plain language for a smart non-expert. No extra keys.`,
      `Question: ${question}\n\nRecords:\n${evidencePack(milestones)}`,
      anthropicKey,
    );
    if (!taught || !taught.answer) return fallback;
    const allowed = new Set(milestones.map((m) => m.id));
    const citedIds = (taught.citedIds || []).filter((id) => allowed.has(id));
    return {
      answer: taught.answer,
      citedIds: citedIds.length ? citedIds : fallback.citedIds,
      model: "claude",
    };
  } catch {
    return fallback;
  }
}

async function checkNotes(notes, milestones, anthropicKey) {
  const fallback = extractiveCheck(notes, milestones);
  if (!anthropicKey) return fallback;
  try {
    const checked = await claudeJson(
      `Compare learner notes to the evidence pack. Return JSON only: {"covered":["..."],"gaps":["..."],"question":"...","model":"claude"}. Gaps must be facts present in the records but missing or wrong in the notes. Pose one comprehension question that requires a specific record. Do not invent facts.`,
      `Notes:\n${notes}\n\nRecords:\n${evidencePack(milestones)}`,
      anthropicKey,
    );
    if (!checked || !checked.question) return fallback;
    return {
      covered: checked.covered || [],
      gaps: checked.gaps || [],
      question: checked.question,
      model: "claude",
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  extractiveTeach,
  extractiveCheck,
  teachQuestion,
  checkNotes,
  KEY_POINTS,
  evidencePack,
  claudeJson,
};
