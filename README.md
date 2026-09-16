# CiteLine

Grounded life-science tutor for the Cursor × Amass hackathon.

Static HTML/JS plus a tiny Node proxy. Off-white agent workspace: sidebar, dotted canvas, bottom search. See **UI.md**.

## Run

```bash
cp .env.example .env
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

- Type a topic in the bottom bar (try `GLP-1 receptor` or `gene editing`).
- Click a node for the cited paper/trial.
- Notes tray is demo chrome only.

`AMASS_API_KEY` in `.env` enables live multi-core search. GLP-1 stays cached for a reliable demo path.
