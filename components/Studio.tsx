"use client";

import { useCallback, useMemo, useState } from "react";
import { ScienceTimeline } from "@/components/ScienceTimeline";
import { ProteinViewer } from "@/components/ProteinViewer";
import { TutorPanel } from "@/components/TutorPanel";
import { UnderstandingCheck } from "@/components/UnderstandingCheck";
import {
  GOLDEN_DEMO_QUESTION,
  GOLDEN_NOTES_EXAMPLE,
  GOLDEN_TOPIC,
} from "@/lib/golden-path";
import type { CheckResult, LearnResult, TeachResult } from "@/lib/types";

export function Studio() {
  const [topic, setTopic] = useState(GOLDEN_TOPIC);
  const [data, setData] = useState<LearnResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [teach, setTeach] = useState<TeachResult | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [askBusy, setAskBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notesPreset, setNotesPreset] = useState("");
  const [playing, setPlaying] = useState(false);

  const selected = useMemo(
    () => data?.milestones.find((m) => m.id === selectedId) ?? null,
    [data, selectedId],
  );

  const loadTopic = useCallback(async (value: string) => {
    setLoading(true);
    setError(null);
    setTeach(null);
    setCheck(null);
    setSelectedId(null);
    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: value }),
      });
      if (!res.ok) throw new Error("Learn request failed");
      const json = (await res.json()) as LearnResult;
      setData(json);
      setAnimKey((k) => k + 1);
      window.setTimeout(() => {
        const gene = json.milestones.find((m) => m.kind === "gene");
        setSelectedId(gene?.id ?? json.milestones[0]?.id ?? null);
      }, 900);
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const askWith = useCallback(async (pack: LearnResult, question: string) => {
    setAskBusy(true);
    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, milestones: pack.milestones }),
      });
      const json = (await res.json()) as TeachResult;
      setTeach(json);
      if (json.citedIds[0]) setSelectedId(json.citedIds[0]);
    } finally {
      setAskBusy(false);
    }
  }, []);

  const checkWith = useCallback(async (pack: LearnResult, notes: string) => {
    setCheckBusy(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes, milestones: pack.milestones }),
      });
      setCheck((await res.json()) as CheckResult);
    } finally {
      setCheckBusy(false);
    }
  }, []);

  const playDemo = useCallback(async () => {
    setPlaying(true);
    setTopic(GOLDEN_TOPIC);
    const json = await loadTopic(GOLDEN_TOPIC);
    if (!json) {
      setPlaying(false);
      return;
    }
    await sleep(2200);
    await askWith(json, GOLDEN_DEMO_QUESTION);
    await sleep(1200);
    setNotesPreset(GOLDEN_NOTES_EXAMPLE);
    await checkWith(json, GOLDEN_NOTES_EXAMPLE);
    setPlaying(false);
  }, [askWith, checkWith, loadTopic]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--teal)]">
            Cursor × Amass · CiteLine
          </p>
          <h1 className="font-display mt-2 max-w-3xl text-4xl leading-[1.05] md:text-6xl">
            Ask science that can show its work.
          </h1>
          <p className="mt-4 max-w-2xl text-[var(--paper-dim)]">
            Other models give confident prose you cannot verify. CiteLine builds
            a cited, animated timeline from Amass cores, teaches only from those
            records, and then checks whether you actually learned.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void playDemo()}
          disabled={playing || loading}
          className="self-start rounded-full border border-[var(--teal)] px-5 py-2 text-sm text-[var(--teal)] hover:bg-[var(--teal)] hover:text-[var(--ink)]"
        >
          {playing ? "Playing golden path…" : "Play 1-min demo"}
        </button>
      </header>

      <form
        className="mt-8 flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void loadTopic(topic);
        }}
      >
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--ink-2)] px-5 py-3 outline-none focus:border-[var(--teal)]"
          placeholder="Drug class, gene, disease — try GLP-1 receptor"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--paper)] px-6 py-3 text-sm font-medium text-[var(--ink)]"
        >
          {loading ? "Retrieving cores…" : "Build timeline"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}

      {data && (
        <p className="mt-3 text-xs text-[var(--paper-dim)]">
          {data.cached
            ? "Golden-path cache (demo-safe). "
            : "Live Amass search. "}
          {data.liveAmass ? "Multi-core query succeeded." : "Amass live key not required for this path."}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--ink-2)]/80 p-3 md:p-4">
        {data ? (
          <ScienceTimeline
            key={animKey}
            milestones={data.milestones}
            selectedId={selectedId}
            citedIds={teach?.citedIds ?? []}
            onSelect={setSelectedId}
            animate
          />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--paper-dim)]">
            The timeline is the spine. Load a topic and milestones will build in.
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ProteinViewer protein={data?.protein ?? null} />
        <TutorPanel
          data={data}
          selected={selected}
          teach={teach}
          busy={askBusy}
          onAsk={(q) => {
            if (data) void askWith(data, q);
          }}
          demoQuestion={GOLDEN_DEMO_QUESTION}
        />
      </div>

      <div className="mt-4">
        <UnderstandingCheck
          key={notesPreset}
          data={data}
          result={check}
          busy={checkBusy}
          onCheck={(n) => {
            if (data) void checkWith(data, n);
          }}
          presetNotes={notesPreset}
        />
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}
