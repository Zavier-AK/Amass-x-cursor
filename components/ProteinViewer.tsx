"use client";

import { useEffect, useRef, useState } from "react";
import type { ProteinInfo } from "@/lib/types";

declare global {
  interface Window {
    $3Dmol?: {
      createViewer: (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => {
        addModel: (data: string, format: string) => void;
        setStyle: (sel: object, style: object) => void;
        zoomTo: () => void;
        render: () => void;
        spin: (axis: boolean | string, speed?: number) => void;
        resize: () => void;
        clear: () => void;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function load3dmol() {
  if (window.$3Dmol) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://3Dmol.org/build/3Dmol-min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("3Dmol failed to load"));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export function ProteinViewer({ protein }: { protein: ProteinInfo | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!protein || !host.current) return;
    const el = host.current;
    const uniprotId = protein.uniprotId;
    let cancelled = false;

    async function run() {
      setStatus("Loading AlphaFold…");
      try {
        await load3dmol();
        const res = await fetch(`/api/pdb/${uniprotId}`);
        if (!res.ok) throw new Error("No AlphaFold model");
        const pdb = await res.text();
        if (cancelled || !window.$3Dmol) return;
        el.innerHTML = "";
        const viewer = window.$3Dmol.createViewer(el, {
          backgroundColor: "#10141c",
          antialias: true,
        });
        viewer.addModel(pdb, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum", thickness: 0.2 } });
        viewer.zoomTo();
        viewer.render();
        viewer.spin("y", 0.6);
        setStatus("live");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "structure failed");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [protein]);

  if (!protein) {
    return (
      <aside className="rounded-2xl border border-[var(--line)] bg-[var(--ink-2)] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--paper-dim)]">
          Structure
        </p>
        <p className="mt-3 text-sm text-[var(--paper-dim)]">
          No UniProt mapping yet. GeneCore → UniProt → AlphaFold is the path we
          prove on the golden topic.
        </p>
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ink-2)]">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--teal)]">
            AlphaFold · {protein.uniprotId}
          </p>
          <h2 className="font-display mt-1 text-xl">
            {protein.symbol}{" "}
            <span className="text-[var(--paper-dim)]">receptor</span>
          </h2>
        </div>
        <a
          className="text-xs text-[var(--paper-dim)] underline decoration-[var(--line)]"
          href={`https://www.uniprot.org/uniprotkb/${protein.uniprotId}`}
          target="_blank"
          rel="noreferrer"
        >
          UniProt
        </a>
      </div>
      <p className="px-4 pb-3 pt-1 text-sm leading-relaxed text-[var(--paper-dim)]">
        {protein.summary}
      </p>
      <div
        ref={host}
        className="h-[280px] w-full cursor-grab active:cursor-grabbing"
      />
      {status !== "live" && (
        <p className="px-4 py-2 text-xs text-[var(--amber)]">{status}</p>
      )}
      {status === "live" && (
        <p className="px-4 py-2 text-xs text-[var(--paper-dim)]">
          Drag to rotate — this is the AlphaFold model, not an illustration.
        </p>
      )}
    </aside>
  );
}
