# Interactive Learning Timeline — grounded life-science tutor

Reference brief for the Cursor × Amass hackathon. Implementation lives in this repo as **CiteLine**.

## What it is

An interactive learning tool for life-science topics, built on the Amass API.
Type a topic (drug class, gene, disease) → get a cited, animated timeline of how
that science developed, every milestone clickable to source. A teaching layer on
top explains each point in plain language and answers questions, grounded only in
the retrieved evidence — and checks the learner's own understanding.

## The gap we're filling

Amass is built for experts (researchers, pharma, investment teams). No one serves
*learners* — students, journalists, patients, new analysts. The hero isn't the
visualization (Amass has timeline templates) — it's the **teaching intelligence**
that makes cutting-edge science learnable for a non-expert.

## Wow features

1. **Animated graph/timeline** — milestones build in along the timeline; the motion
   is the visual hook, not a static chart.
2. **Interactive 3D protein** — if the topic involves a protein, pull its structure
   from the free AlphaFold API and render it live/rotatable (3Dmol.js).
3. **Understanding check** — the learner pastes their own notes on a topic (e.g.
   gene editing); we parse them against the grounded evidence, flag gaps, and pose a
   question to test comprehension. (Real, thin implementation — one grounded LLM call.)

## Stack

- Frontend: React / Next.js
- Timeline: vis-timeline (interactive, animated, clickable)
- 3D protein: 3Dmol.js
- Teaching + understanding-check: Claude API (when `ANTHROPIC_API_KEY` is set),
  grounded on retrieved Amass records; extractive fallback so the demo never dies
- Data: Amass API (BioMedCore, TrialCore, DrugCore, RegulatoryCore, GeneCore)
  + AlphaFold DB

## Flow

```
Topic input
├─ Amass API → cited animated timeline (vis-timeline)
│ → extract protein/gene ID
├─ AlphaFold API (by UniProt ID) → 3D structure (3Dmol.js)
├─ Claude (grounded on records) → plain-language teaching + Q&A
└─ Learner notes → grounded gap check + comprehension question
```

## Build order (demo can't fully break)

1. Timeline from Amass — the spine, working first
2. Teaching layer — the differentiator
3. AlphaFold 3D — the wow, additive
4. Understanding check — completes the learning loop

## Key risk

Two API integrations: (a) Amass query shape, (b) mapping Amass gene/protein record
→ UniProt ID → AlphaFold fetch. Prove both early.

**Mitigation:** golden-path topic `GLP-1 receptor` is pre-cached (timeline + gene +
UniProt `P43220` + sample Q&A + notes). Live Amass is used when `AMASS_API_KEY` is
present and the topic is not the cached demo. AlphaFold is fetched by UniProt ID
through a same-origin proxy.

## Demo — 1 min, guided visual walkthrough (golden path, pre-cached)

1. **Hook (~10s):** "Ask any AI about cutting-edge science, you get confident prose
   you can't verify. We built a tutor where every word is real and clickable." Type topic.
2. **Timeline animates in (~15s):** milestones build along the graph.
3. **3D protein renders (~10s):** structure spins up, rotate live — "the actual
   receptor, from AlphaFold."
4. **Ask a question (~15s):** grounded answer appears, citations light up, relevant
   timeline node highlights.
5. **Understanding check (~10s):** paste learner notes → gap flagged + question posed.
   "It doesn't just teach — it checks you actually learned."

## Demo safety

Pre-cache the golden-path topic (timeline + protein + answers + notes example) so
everything loads instantly regardless of API latency. Rehearse the exact 1-min path.
Make the one golden path bulletproof, not arbitrary input.

Use **Play 1-min demo** on the landing view. It types `GLP-1 receptor`, animates
the timeline, asks the obesity-expansion question, then runs the notes check.

## Environment

Copy `.env.example` to `.env.local`:

- `AMASS_API_KEY` — live multi-core search (optional for the golden path)
- `ANTHROPIC_API_KEY` — grounded Claude teaching + understanding check (optional;
  extractive grounded fallback is always on)
