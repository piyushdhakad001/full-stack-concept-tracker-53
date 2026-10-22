// One server: API + built React app.
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "5mb" }));

// Set DATA_DIR to a persistent disk path on your host to keep progress across deploys
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, "data.json");
const MARKS_FILE = path.join(DATA_DIR, "marks.json");

// First run on a fresh disk: copy the bundled content
const seed = path.join(__dirname, "data.json");
if (!fs.existsSync(DATA_FILE) && fs.existsSync(seed)) fs.copyFileSync(seed, DATA_FILE);

const readJSON = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// --- content ---
app.get("/api/data", (req, res) => res.json(readJSON(DATA_FILE, {})));
app.put("/api/data", (req, res) => { writeJSON(DATA_FILE, req.body); res.json({ ok: true }); });

// --- progress ---
app.get("/api/marks", (req, res) => res.json(readJSON(MARKS_FILE, {})));
app.put("/api/marks", (req, res) => {
  const { key, status } = req.body;
  const marks = readJSON(MARKS_FILE, {});
  if (status) marks[key] = status; else delete marks[key];
  writeJSON(MARKS_FILE, marks);
  res.json(marks);
});
app.delete("/api/marks/:category", (req, res) => {
  const marks = readJSON(MARKS_FILE, {});
  Object.keys(marks).forEach((k) => { if (k.startsWith(req.params.category + ":")) delete marks[k]; });
  writeJSON(MARKS_FILE, marks);
  res.json(marks);
});

// --- built frontend ---
const DIST = path.join(__dirname, "../dist");
app.use(express.static(DIST));
app.get("*", (req, res) => res.sendFile(path.join(DIST, "index.html")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
