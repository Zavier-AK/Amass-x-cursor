# CiteLine

Grounded life-science tutor for the Cursor × Amass hackathon.

Static HTML/JS plus a tiny Node proxy. No React, no Next, no bundler.

## Run

```bash
cp .env.example .env
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

`npm start` and `npm run dev` also run `node server.js`.

The server binds `0.0.0.0` on `process.env.PORT` or **3000**. It loads `.env` from the working directory by parsing `KEY=value` lines (existing environment variables win).

- Without keys: the **GLP-1 receptor** golden path is fully cached (timeline, teaching, understanding check). AlphaFold still fetches UniProt `P43220` live.
- `AMASS_API_KEY`: live multi-core search for other topics, and `GET /api/amass/*` proxy to `https://api.amass.tech/api/v1/*`.
- `ANTHROPIC_API_KEY`: Claude teaching + notes check, still constrained to retrieved records.

## Demo

Click **Play 1-min demo**. It types the golden topic, animates the timeline and citation graph, asks the obesity-expansion question, then runs the notes gap-check.
