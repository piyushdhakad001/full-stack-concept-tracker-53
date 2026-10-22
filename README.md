# Concept Tracker (React + Express, single deploy)

One project, one `package.json`, one server. The server serves both the API and the built app.

## Run locally (development)
```bash
npm install
npm run dev        # open http://localhost:5173
```

## Production (this is what hosts run)
```bash
npm install
npm run build      # builds the React app into dist/
npm start          # API + app on http://localhost:5000
```

## Deploy (Render / Railway / any Node host)
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Push to GitHub, connect the repo, done. No separate frontend/backend.

## Keeping progress
Progress is saved in `server/marks.json`. Many hosts wipe files on every deploy.
To keep progress, attach a persistent disk and set env var `DATA_DIR` to its path (e.g. `/data`).

## Edit content
Edit `server/data.json` (shape: `{ "definition": [], "comparison": [], "process": [], "multiple": [] }`).
