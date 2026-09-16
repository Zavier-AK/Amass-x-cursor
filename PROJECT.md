# CiteLine — grounded life-science tutor (demo)

Hackathon brief. Demo-first, not a product. Type a topic → cited timeline, citation graph, 3D protein, and a thin teaching loop, all grounded on **live Amass** records.

## What it is

An interactive learning tool for life-science topics, built on the Amass API.
Type a topic (drug class, gene, disease) → get a cited, animated timeline of how
that science developed, every milestone clickable to source. A teaching layer on
top explains each point in plain language and answers questions, grounded only in
the retrieved evidence — and checks the learner's own understanding.

A **citation graph** sits beside the timeline: papers as nodes, Amass
`references` / `citedBy` as edges, so you can see how the literature actually
connects (and hop paper → trial → drug when cross-core IDs exist).

## The gap we're filling

Amass is built for experts (researchers, pharma, investment teams). No one serves
*learners* — students, journalists, patients, new analysts. The hero isn't the
visualization (Amass has timeline templates) — it's the **teaching intelligence**
that makes cutting-edge science learnable for a non-expert.

## Wow features (demo)

1. **Animated timeline** — milestones build in; motion is the hook, not a static chart.
2. **Citation / relation graph** — vis-network nodes: papers linked by Amass
   BiomedCore `references` and `citedBy`; optional edges to trials/drugs via
   `referencesTrialCore` / DrugCore IDs.
3. **Interactive 3D protein** — if the topic has a gene/protein, AlphaFold PDB
   rendered live/rotatable (3Dmol.js).
4. **Understanding check** — paste notes → gaps + one comprehension question,
   grounded on retrieved records (one optional LLM call; extractive fallback).

## Stack (HTML / JS only)

No React, no Next, no build step. Static files + CDN libraries.

- **UI:** plain HTML, CSS, JavaScript (`index.html`, `css/`, `js/`)
- **Timeline:** [vis-timeline](https://unpkg.com/vis-timeline/standalone/umd/vis-timeline-graph2d.min.js)
- **Graph:** [vis-network](https://unpkg.com/vis-network/standalone/umd/vis-network.min.js) (same vis.js family; papers as nodes)
- **3D protein:** [3Dmol.js](https://3Dmol.org) via CDN — purpose-built for PDB; better fit than Three.js here
- **Serve:** any static server (`npx serve` or Python `http.server`)
- **Live Amass:** tiny same-origin proxy (~20 lines) so `AMASS_API_KEY` never ships in the page and CORS is not an issue. Browser talks to `/api/amass/...`; proxy forwards to `https://api.amass.tech/api/v1`.
- **Teaching:** extractive grounded answers from Amass abstracts always on; Claude only if `ANTHROPIC_API_KEY` is set on the proxy

**Data:** Amass live — BiomedCore (search + `include=references,citedBy,referencesTrialCore`), TrialCore, DrugCore, RegulatoryCore, GeneCore. AlphaFold DB by UniProt ID.

## Flow

```
Topic input
├─ Live Amass search (multi-core) → cited animated timeline
│ → BiomedCore references / citedBy → citation graph (vis-network)
│ → extract protein/gene ID
├─ AlphaFold API (by UniProt ID) → 3D structure (3Dmol.js)
├─ Grounded teaching + Q&A (extractive; Claude optional)
└─ Learner notes → grounded gap check + comprehension question
```

## Build order (demo can't fully break)

1. Timeline from live Amass — the spine
2. Citation graph from `references` / `citedBy` — the extra visual
3. Teaching layer — the differentiator
4. AlphaFold 3D — the wow, additive
5. Understanding check — completes the learning loop

## Key risk

Two API integrations: (a) Amass query shape + citation graph from `references` /
`citedBy`, (b) mapping Amass gene/protein → UniProt ID → AlphaFold fetch.
Prove both early.

**Mitigation:** golden-path topic `GLP-1 receptor` is pre-cached (timeline + graph
+ gene + UniProt `P43220` + sample Q&A + notes) so the 1-min path never depends
on latency. **Live Amass is the default for any other topic** when
`AMASS_API_KEY` is present. Golden-path can also be re-fetched live with a
toggle. AlphaFold is fetched by UniProt ID through the same tiny proxy.

## Demo — 1 min, guided visual walkthrough (golden path)

Keep this path exactly. Rehearse it. Make it bulletproof.

1. **Hook (~10s):** "Ask any AI about cutting-edge science, you get confident prose
   you can't verify. We built a tutor where every word is real and clickable." Type topic.
2. **Timeline animates in (~15s):** milestones build along the graph.
3. **Citation graph (~same beat):** papers light up as a node graph — "this isn't
   a list, it's how the literature cites itself." Click a node → source.
4. **3D protein renders (~10s):** structure spins up, rotate live — "the actual
   receptor, from AlphaFold."
5. **Ask a question (~15s):** grounded answer appears, citations light up, relevant
   timeline **and** graph nodes highlight.
6. **Understanding check (~10s):** paste learner notes → gap flagged + question posed.
   "It doesn't just teach — it checks you actually learned."

Use **Play 1-min demo** on the landing view. It types `GLP-1 receptor`, animates
the timeline + citation graph, asks the obesity-expansion question, then runs
the notes check.

## Demo safety

Pre-cache the golden-path topic (timeline + graph + protein + answers + notes
example) so everything loads instantly regardless of API latency. Rehearse the
exact 1-min path. Make the one golden path bulletproof, not arbitrary input.

Live Amass still runs for other topics. Do not build a full product around
auth, accounts, or arbitrary robustness — one demo path, live data, CDN UI.

## Environment

Copy `.env.example` to `.env` (read by the tiny proxy only):

- `AMASS_API_KEY` — live multi-core search + citation graph (required for live data)
- `ANTHROPIC_API_KEY` — optional grounded Claude teaching + understanding check
  (extractive fallback always on)
