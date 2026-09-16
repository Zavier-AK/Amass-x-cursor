# CiteLine

Grounded life-science tutor for the Cursor × Amass hackathon.

Read **[PROJECT.md](./PROJECT.md)** for the product brief, demo path, and risks.

## Run

```bash
npm install
cp .env.example .env.local   # optional keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Without keys: the **GLP-1 receptor** golden path is fully cached (timeline, teaching, understanding check). AlphaFold still fetches UniProt `P43220` live.
- `AMASS_API_KEY`: live BioMedCore / TrialCore / DrugCore / RegulatoryCore / GeneCore search for other topics.
- `ANTHROPIC_API_KEY`: Claude teaching + notes check, still constrained to retrieved records.

## Demo

Click **Play 1-min demo**. It types the golden topic, animates vis-timeline, loads the receptor, asks the obesity-expansion question, then runs the notes gap-check.
