"use client";

import { useState } from "react";
import type { CheckResult, LearnResult } from "@/lib/types";
import { GOLDEN_NOTES_EXAMPLE } from "@/lib/golden-path";

type Props = {
  data: LearnResult | null;
  result: CheckResult | null;
  busy: boolean;
  onCheck: (notes: string) => void;
  presetNotes?: string;
};

export function UnderstandingCheck({
  data,
  result,
  busy,
  onCheck,
  presetNotes,
}: Props) {
  const [notes, setNotes] = useState(presetNotes ?? "");

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--ink-2)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--amber)]">
        Understanding check
      </p>
      <h2 className="font-display text-xl">Paste what you think you know</h2>
      <p className="mt-1 text-sm text-[var(--paper-dim)]">
        We compare your notes to the same evidence pack — flag gaps, then pose
        one question. It does not just teach; it checks you actually learned.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder={GOLDEN_NOTES_EXAMPLE}
        className="mt-3 w-full resize-none rounded-xl border border-[var(--line)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--amber)]"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={!data || busy || !notes.trim()}
          onClick={() => onCheck(notes)}
          className="rounded-full bg-[var(--amber)] px-4 py-1.5 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {busy ? "Checking…" : "Check understanding"}
        </button>
      </div>
      {result && (
        <div className="rise mt-3 grid gap-3 md:grid-cols-2">
          <ul className="rounded-xl bg-black/25 p-3 text-sm">
            <li className="text-xs uppercase tracking-wide text-[var(--teal)]">
              Covered
            </li>
            {result.covered.map((c) => (
              <li key={c} className="mt-1 text-[var(--paper-dim)]">
                · {c}
              </li>
            ))}
            {result.covered.length === 0 && (
              <li className="mt-1 text-[var(--paper-dim)]">Nothing matched yet.</li>
            )}
          </ul>
          <ul className="rounded-xl bg-black/25 p-3 text-sm">
            <li className="text-xs uppercase tracking-wide text-[var(--rose)]">
              Gaps
            </li>
            {result.gaps.map((c) => (
              <li key={c} className="mt-1 text-[var(--paper-dim)]">
                · {c}
              </li>
            ))}
          </ul>
          <p className="md:col-span-2 rounded-xl border border-[var(--amber)]/40 bg-[#2a220f] p-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-[var(--amber)]">
              Question · {result.model}
            </span>
            <span className="mt-1 block">{result.question}</span>
          </p>
        </div>
      )}
    </section>
  );
}
