"use client";

import { useState } from "react";
import type { LearnResult, Milestone, TeachResult } from "@/lib/types";

type Props = {
  data: LearnResult | null;
  selected: Milestone | null;
  teach: TeachResult | null;
  busy: boolean;
  onAsk: (q: string) => void;
  demoQuestion: string;
};

export function TutorPanel({
  data,
  selected,
  teach,
  busy,
  onAsk,
  demoQuestion,
}: Props) {
  const [q, setQ] = useState("");

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-[var(--line)] bg-[var(--ink-2)]">
      <header className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--teal)]">
          Teaching layer
        </p>
        <h2 className="font-display text-xl">Grounded in retrieved records</h2>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed">
        {selected ? (
          <div className="rise rounded-xl bg-black/25 p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--paper-dim)]">
              {selected.date.slice(0, 4)} · {selected.kind}
            </p>
            <p className="mt-1 font-medium">{selected.title}</p>
            <p className="mt-2 text-[var(--paper-dim)]">{selected.teach}</p>
            <a
              className="mt-2 inline-block text-xs text-[var(--teal)] underline"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open source · {selected.sourceLabel}
            </a>
          </div>
        ) : (
          <p className="text-[var(--paper-dim)]">
            Click a milestone — the tutor only narrates that record, with a
            clickable source.
          </p>
        )}

        {teach && (
          <div className="rise rounded-xl border border-[var(--teal-dim)]/40 bg-[#10231f] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--teal)]">
              Answer · {teach.model}
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-[var(--paper)]">
              {teach.answer}
            </pre>
          </div>
        )}
      </div>

      <form
        className="border-t border-[var(--line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const next = q.trim() || demoQuestion;
          onAsk(next);
        }}
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={demoQuestion}
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--line)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--paper-dim)]">
            {data
              ? `${data.milestones.length} records in the evidence pack`
              : "Load a topic first"}
          </p>
          <button
            type="submit"
            disabled={!data || busy}
            className="rounded-full bg-[var(--teal)] px-4 py-1.5 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
          >
            {busy ? "Grounding…" : "Ask"}
          </button>
        </div>
      </form>
    </section>
  );
}
