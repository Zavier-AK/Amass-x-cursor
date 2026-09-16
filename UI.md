# UI plan — agent workspace for grounded science

Planning only. Do not implement from this file until we say so.

This replaces the current CiteLine landing-page layout with a **Cursor-like agent workspace**: left project sidebar, infinite dotted canvas as the main tab, chat/search docked at the bottom, notes as a drop-in tray. Palette is **off-white + one nice orange**, black type, lots of air. Minimal, no clutter — not a dark dashboard, not teal/amber chrome.

Reference still: `PROJECT.md` (product) and `AMASS.MD` (API). This file is layout, chrome, and interaction only.

---

## Visual system

Off-white field, one orange, rounded cards, almost nothing else. Amass site energy (dot grid + black type + a small orange label) without the marketing blobs.

### Colour

| Token | Approx | Use |
| --- | --- | --- |
| Off-white | `#f7f4ee` / `#f6f3ec` | Page, canvas, sidebar wash — warm paper, not stark `#fff`, not cream-yellow |
| White | `#ffffff` | Node cards, composer, inspector — sit slightly above the off-white |
| Ink | `#1a1a1a` | Titles only |
| Mute | `#8a8680` | Subtitles, years, helper copy |
| Hairline | `#e6e1d8` | Borders, edges, sidebar rules |
| Orange | `#f26b21` (Amass-like; warm, not neon, not amber) | **The only accent.** Small labels, selected node ring / hairline, send control, active sidebar tick. Never a full-card fill, never a rainbow of node colours |

Dots on the canvas: same orange or warm grey at ~8–12% opacity, even spacing. Texture, not a pattern you notice first.

### Shape and chrome

- **Nodes are rounded.** Generous radius (~16–20px), white card, 1px hairline, no drop shadow (or a whisper). Selected = thin orange ring, still rounded — not a black box, not a pill of orange fill.
- Composer and inspector: same radius family.
- Sidebar rows: slight rounding on the active state, off-white/grey wash, orange only as a 2px leading edge or tiny mark.

### Minimal — no clutter

- One typeface, two sizes that matter (title / body). No badges soup, no icons on every row, no colour-coded kinds.
- Source kind (`Paper`) is grey text, not a chip in four colours.
- Empty canvas: one sentence. Researching: one line. Inspector: title, source, two lines, one link.
- If an element is not needed for the demo beat, it is not on screen.

No gradients, no spectrum cartoons, no teal, no extra accent colours. Off-white + orange + ink. The canvas is quiet; the orange is the pointer.

---

## Layout (three regions, always)

```
┌────────────┬──────────────────────────────────────────────┐
│            │                                              │
│  PROJECT   │           MAIN TAB  (dotted canvas)          │
│  SIDEBAR   │     pan / zoom · nodes · edges · papers      │
│            │                                              │
│  topics    │──────────────────────────────────────────────│
│  chats     │  NOTES TRAY (collapsed / drop-in)            │
│            │──────────────────────────────────────────────│
│            │  BOTTOM SEARCH  (agent chat bar)             │
└────────────┴──────────────────────────────────────────────┘
```

- **Left:** Cursor-style project sidebar. Topics / past chats. Fixed width, collapsible.
- **Centre, most of the viewport:** the interactive dotted canvas. This is the product. Scalable (pinch/scroll zoom, pan). Nodes spawn here after a query.
- **Bottom of the centre column:** Claude/Cursor-style composer. Always visible. Query goes here.
- **Notes:** a slim drop-in / paste tray above the composer or as a drawer from the sidebar. Demo chrome only — not wired.

The first paint is mostly empty canvas + sidebar + bar. No hero marketing block.

---

## 1. Project sidebar (Cursor analogue)

Looks like Cursor’s file/chat rail, not a marketing nav.

- Product mark + wordmark at top (small, black)
- **New topic** control (ghost button)
- List of **topics / chats**, newest first. Each row: topic title, one-line subtitle (e.g. `Gene editing · 14 nodes`), relative time
- Active row: off-white/grey wash + a thin orange leading edge — not a loud pill
- Optional groups later: *Today*, *Previous* — skip if it clutters the demo
- Bottom of rail: collapsed account / settings stub (non-functional)

Selecting a row swaps the **main canvas + that topic’s node graph**. Different searches are different chats, like agent threads.

Demo seed rows (static): `Gene editing`, `GLP-1 receptor`, plus the empty “New topic” state.

---

## 2. Main tab — dotted canvas (foreground)

This is the Amass dotted background, used as a **map**, not a page texture behind copy.

### Canvas behaviour
- CSS (or canvas) **dot grid**, same density/feel as the attached Amass screenshot
- Pan: click-drag empty space. Zoom: wheel / pinch. Fit-to-graph after nodes land
- Empty state: centred, quiet. One line of black display type, one grey sentence, no illustration
  - e.g. title: `Ask a topic.` body: `A cited timeline will draw itself here.`
- While Amass is running: a single small status on the canvas (`Researching gene editing…`) — not a spinner wall

### After a query (example: gene editing / gene therapy)
1. Bottom bar sends the topic.
2. Amass is queried for a **development timeline** (BioMedCore papers, plus trials/drugs/regulatory when they exist) so breakthroughs are cited, not invented.
3. We cluster that timeline into **main parts / main breakthroughs** (year + claim).
4. For each breakthrough, a **node** is created on the canvas.
5. Edges connect nodes in time (and optionally “this trial rests on this paper”).
6. Nodes **appear in order** along the timeline (the motion is the hook). Layout is a left→right year axis, slightly staggered so it reads as a graph, not a Gantt.

### Node
- **Rounded rectangle** (16–20px), white on off-white, plenty of padding, one title + one subline. Nothing else on the card until selected.
- Label pattern: `{topic} · {year}` — e.g. `Gene editing · 2003`
- Subline: short breakthrough name (what happened)
- Kind (`Paper` / `Trial` / `Drug` / `Label`) as muted grey text only if needed — not a coloured badge
- Every node **owns the underlying study**: Amass id, title, year, PMID/NCT/DOI, outbound URL
- **Click:** inspector (right sheet or floating card, same rounding) shows the referenced paper/trial — title, authors/journal or NCT, two-line grounded summary, **Open source**. That is the teaching click. No separate “tutor essay” panel in v1 of this UI
- Selected node: **orange hairline ring** (still rounded); connected edges a shade darker grey. Unselected nodes stay quiet.

Demo sentence to keep in mind: *if there was a major breakthrough in gene editing in 2003, the node says “Gene editing · 2003”; click it, and the paper that supports that discovery is what you see.*

---

## 3. Bottom search bar (Claude / Cursor analogue)

Docked to the bottom of the main column, floating on the dotted field (white pill, hairline, wide, not full-bleed ugly).

- Placeholder: `Ask a life-science topic…` or `Gene therapy, GLP1R, CRISPR…`
- Text area that grows one–two lines, then scrolls
- Send on Enter; Shift+Enter newline
- Right: send affordance (arrow). No model picker, no rainbow attachments
- After send: the bar stays; a quiet “researching” state; nodes start landing above
- Follow-up messages in the same topic (e.g. “what changed after 2012?”) add/highlight nodes on **this** canvas, they do not open a second page

This is the only primary input. The old top search form and “Play 1-min demo” marketing header go away.

---

## 4. Notes drop-in (demo chrome, not functional)

A small **menu / drop zone** — not a second product.

Placement (pick one in implementation; plan prefers A):

- **A.** Tab or chevron above the composer: `Notes` — expands a short tray: “Drop or paste notes.” Dashed hairline well, grey helper text
- **B.** Item in the left sidebar under the current topic

Copy for the well: `Drop notes to check understanding.` Helper: `We’ll parse them against the timeline, flag gaps, and add nodes for what you missed.`

**This demo does not parse files or call a model.** Clicking / dropping can (optionally) spawn **one or two fake “gap” nodes** on the canvas so the *idea* is visible — or do nothing except show a toast `Demo — notes check not wired`. Do not build the real understanding-check pipeline in this pass.

Intended later behaviour (not this task): notes vs grounded Amass records → gaps → extra nodes on the same graph (missing years, missing trials) + one comprehension question.

---

## What a query feels like (gene editing)

1. User is in a topic thread (new or existing) in the left rail.
2. Types `gene editing` in the bottom bar, sends.
3. Canvas status: researching. Amass returns a cited progression.
4. Nodes draw in: e.g. 1987 / 2003 / 2012 / 2013 / 2020… each labeled `Gene editing · {year}`, each holding its paper (or trial).
5. Edges show sequence.
6. User pans/zooms, clicks `Gene editing · 2003`, reads the referenced study in the inspector, opens PubMed.
7. (Demo only) opens Notes tray, pastes something — UI exists; logic does not.

Same loop for `gene therapy` or `GLP-1 receptor`. One canvas per sidebar topic.

---

## Explicitly out of this UI

- Current dark CiteLine marketing page, vis-timeline strip, 3D protein column, tutor essay column, understanding-check form as a full section
- Extra colours, spectrum protein, animated brand blobs from the Amass marketing page (those blobs are *not* our chrome; **off-white, orange, dot grid, type** are)
- Building a working notes parser, working file upload, or a second page for “chat transcript”
- Cluttering the canvas with chat bubbles — chat lives in the bottom bar; the graph *is* the answer

---

## Implementation notes (when we build, not now)

- Keep Next.js. Rebuild `app/page.tsx` / `components/*` around sidebar + canvas + composer
- Canvas: CSS background + a graph lib (React Flow / xyflow is the obvious fit for pan-zoom nodes/edges). vis-timeline is the wrong metaphor for this layout
- Amass: same cores as `PROJECT.md`; node = clustered breakthrough + citation, not one node per raw hit
- Golden-path topic still worth pre-caching for the demo (gene editing or GLP-1), so the canvas fills even if the API is slow
- `.env` / `AMASS_API_KEY` stay local; never land in the UI or in this plan as a value

---

## Open choices (do not block the plan)

1. Inspector as right drawer vs popover on the node
2. Notes tray A (above composer) vs B (sidebar)
3. Whether a notes drop in the demo spawns fake gap nodes or only shows a stub
