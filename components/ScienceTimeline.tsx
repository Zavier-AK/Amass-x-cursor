"use client";

import { useEffect, useRef } from "react";
import type { Milestone } from "@/lib/types";

type Props = {
  milestones: Milestone[];
  selectedId: string | null;
  citedIds: string[];
  onSelect: (id: string) => void;
  animate: boolean;
};

const GROUPS = [
  { id: "literature", content: "Literature" },
  { id: "trial", content: "Trials" },
  { id: "drug", content: "Drugs" },
  { id: "regulatory", content: "Regulatory" },
  { id: "gene", content: "Gene" },
];

export function ScienceTimeline({
  milestones,
  selectedId,
  citedIds,
  onSelect,
  animate,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<import("vis-timeline/standalone").Timeline | null>(
    null,
  );
  const itemsRef = useRef<import("vis-data").DataSet<Record<string, unknown>> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    let timeline: import("vis-timeline/standalone").Timeline | null = null;

    async function mount() {
      const [{ Timeline, DataSet }] = await Promise.all([
        import("vis-timeline/standalone"),
      ]);
      if (cancelled || !host.current) return;

      type ItemRow = {
        id: string;
        group: string;
        start: string;
        content: string;
        title: string;
        className: string;
      };
      const items = new DataSet<ItemRow>([]);
      itemsRef.current = items as unknown as import("vis-data").DataSet<
        Record<string, unknown>
      >;

      timeline = new Timeline(
        host.current,
        items,
        GROUPS,
        {
          stack: true,
          horizontalScroll: true,
          zoomable: true,
          moveable: true,
          orientation: "top",
          height: 280,
          margin: { item: { horizontal: 8, vertical: 6 } },
          tooltip: { followMouse: true },
          template: (item: { title?: string; content?: string }) => {
            const label = String(item.content ?? "");
            return `<span title="${escapeHtml(item.title || label)}">${escapeHtml(truncate(label, 42))}</span>`;
          },
        },
      );

      timeline.on("select", (props: { items: string[] }) => {
        if (props.items[0]) onSelect(props.items[0]);
      });

      timelineRef.current = timeline;

      const payload = milestones.map((m) => ({
        id: m.id,
        group: m.kind,
        start: m.date,
        content: m.title,
        title: `${m.date.slice(0, 4)} · ${m.sourceLabel}\n${m.summary}`,
        className: `kind-${m.kind}`,
      }));

      if (animate) {
        items.clear();
        payload.forEach((row, i) => {
          window.setTimeout(() => {
            if (cancelled) return;
            items.add(row);
            timeline?.focus(row.id, { animation: { duration: 280, easingFunction: "easeInOutQuad" } });
          }, 90 + i * 140);
        });
        window.setTimeout(() => {
          if (!cancelled) timeline?.fit({ animation: true });
        }, 90 + payload.length * 140 + 200);
      } else {
        items.add(payload);
        timeline.fit();
      }
    }

    void mount();
    return () => {
      cancelled = true;
      timeline?.destroy();
      timelineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, animate]);

  useEffect(() => {
    const tl = timelineRef.current;
    const items = itemsRef.current;
    if (!tl || !items) return;
    const ids = items.getIds() as string[];
    ids.forEach((id) => {
      const current = items.get(id) as { className?: string } | null;
      if (!current) return;
      const base = (current.className || "").replace(/\s*(cited|is-selected)/g, "");
      const extras = [
        citedIds.includes(id) ? "cited" : "",
        selectedId === id ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      items.update({ id, className: `${base} ${extras}`.trim() });
    });
    if (selectedId) {
      try {
        tl.setSelection([selectedId]);
      } catch {
        /* item may not be added yet during animation */
      }
    }
  }, [selectedId, citedIds, milestones]);

  return <div ref={host} className="h-[280px] w-full" />;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
