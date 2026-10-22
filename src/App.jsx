import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

/* =====================================================================
   1. CONFIG  - categories and the parts (columns) every item has.
   "key" must match the property name in server/data.json.
   type: code | list | quote | warn | tip | (none = normal text)
   ===================================================================== */
const CATEGORIES = [
  {
    id: "definition", label: "Definition", short: "Define", icon: "📘", color: "#6366f1", titleLabel: "Topic name",
    fields: [
      { key: "definition", label: "Definition", icon: "📖" },
      { key: "analogy", label: "Analogy", icon: "💡" },
      { key: "why", label: "Why it exists", icon: "🎯" },
      { key: "how", label: "How it works", icon: "⚙️", type: "list" },
      { key: "example", label: "Example", icon: "💻", type: "code" },
      { key: "interview", label: "Interview line", icon: "🎤", type: "quote" },
    ],
  },
  {
    id: "comparison", label: "Comparison", short: "Compare", icon: "⚖️", color: "#ec4899", titleLabel: "Comparison",
    fields: [
      { key: "definitions", label: "Definitions", icon: "📖" },
      { key: "difference", label: "Key difference", icon: "⚖️", type: "list" },
      { key: "analogy", label: "Comparative analogy", icon: "💡" },
      { key: "when", label: "When to use which", icon: "🧭" },
      { key: "example", label: "Example", icon: "💻", type: "code" },
      { key: "interview", label: "Interview line", icon: "🎤", type: "quote" },
    ],
  },
  {
    id: "process", label: "Process", short: "Process", icon: "🔁", color: "#f97316", titleLabel: "Process",
    fields: [
      { key: "overview", label: "High-level overview", icon: "🔭" },
      { key: "analogy", label: "Strong analogy", icon: "💡" },
      { key: "flow", label: "Step-by-step flow", icon: "🪜", type: "list" },
      { key: "example", label: "Example", icon: "💻", type: "code" },
      { key: "mistake", label: "Common mistake", icon: "⚠️", type: "warn" },
      { key: "interview", label: "Interview line", icon: "🎤", type: "quote" },
    ],
  },
  {
    id: "multiple", label: "Multiple Items", short: "Groups", icon: "🧩", color: "#14b8a6", titleLabel: "Group",
    fields: [
      { key: "purpose", label: "Purpose of the group", icon: "🎯" },
      { key: "analogy", label: "One big analogy", icon: "💡" },
      { key: "items", label: "Go through each item", icon: "📋", type: "list" },
      { key: "example", label: "Example", icon: "💻", type: "code" },
      { key: "memory", label: "Memory trick", icon: "🧠", type: "tip" },
      { key: "interview", label: "Interview line", icon: "🎤", type: "quote" },
    ],
  },
];

const STATUSES = [
  { id: "know", label: "Know", icon: "🔵" },
  { id: "explained", label: "Explained", icon: "🟡" },
  { id: "mastered", label: "Mastered", icon: "🟢" },
];

const OVERVIEW = { id: "overview", label: "Overview", short: "Overview", icon: "📊", color: "#6366f1" };
const TABS = [OVERVIEW, ...CATEGORIES];

/* =====================================================================
   2. HELPERS
   ===================================================================== */
// progress is saved as "category:title" -> status
const markKey = (categoryId, title) => `${categoryId}:${title}`;

function countStatuses(items, categoryId, marks) {
  const counts = { know: 0, explained: 0, mastered: 0, none: 0 };
  items.forEach((item) => { counts[marks[markKey(categoryId, item.title)] || "none"]++; });
  return counts;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// copy works on https/localhost AND on plain http (phone testing over Wi-Fi)
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const box = document.createElement("textarea");
  box.value = text;
  box.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(box);
  box.select();
  document.execCommand("copy");
  box.remove();
  return Promise.resolve();
}

// every call to the backend goes through here
async function api(path, options) {
  const res = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

/* =====================================================================
   3. HOOKS
   ===================================================================== */
// loads content + marks and gives simple actions
function useConcepts() {
  const [data, setData] = useState({});
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/data"), api("/marks")])
      .then(([d, m]) => { setData(d); setMarks(m); })
      .catch(() => setError("Cannot reach the server. Is it running on port 5000?"))
      .finally(() => setLoading(false));
  }, []);

  const setMark = (key, status) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (status) next[key] = status; else delete next[key];
      return next;
    });
    api("/marks", { method: "PUT", body: JSON.stringify({ key, status }) })
      .catch(() => setError("Could not save progress."));
  };

  const resetCategory = (categoryId) => {
    setMarks((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(categoryId + ":"))));
    api(`/marks/${categoryId}`, { method: "DELETE" }).catch(() => setError("Could not reset marks."));
  };

  return { data, marks, loading, error, setMark, resetCategory };
}

// true on phones / small tablets
function useIsMobile() {
  const query = "(max-width: 768px)";
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* =====================================================================
   4. CONTENT BLOCKS  (code, steps, quote, tips ...)
   ===================================================================== */
const KEYWORDS = new Set(
  ("const let var function return if else async await try catch new require " +
   "SELECT FROM WHERE JOIN LEFT RIGHT INNER FULL ON BEGIN COMMIT ROLLBACK UPDATE SET " +
   "CREATE TABLE INDEX PRIMARY KEY REFERENCES INSERT INT TEXT").split(" ")
);

// one line of code: grey comment, amber "strings", purple keywords, blue numbers
function CodeLine({ text }) {
  const m = /(^|\s)(\/\/|#\s|--\s|\/\*)/.exec(text);
  const cut = m ? m.index + m[1].length : text.length;
  const parts = text.slice(0, cut).split(/("[^"]*"|'[^']*'|\b[A-Za-z_]+\b|\b\d+\b)/);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p[0] === '"' || p[0] === "'") return <span key={i} className="tk-str">{p}</span>;
        if (KEYWORDS.has(p)) return <span key={i} className="tk-kw">{p}</span>;
        if (/^\d+$/.test(p)) return <span key={i} className="tk-num">{p}</span>;
        return p;
      })}
      {cut < text.length && <span className="tk-cm">{text.slice(cut)}</span>}
    </>
  );
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  return (
    <div className="code">
      <div className="code-bar">
        <span>Code</span>
        <button onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>
      <pre><code>
        {code.split("\n").map((line, i) => <span className="ln" key={i}><CodeLine text={line} /></span>)}
      </code></pre>
    </div>
  );
}

// numbered steps; "Label: text" gets a bold label
function Steps({ value }) {
  return (
    <ul className="steps">
      {value.split("\n").filter(Boolean).map((line, i) => {
        const text = line.replace(/^\d+\.\s*/, "");
        const m = /^([^:]{1,28}):\s+(.*)$/.exec(text);
        const labelled = m && m[1].trim().split(/\s+/).length <= 4;
        return (
          <li key={i}>
            <span>{labelled ? <><strong>{m[1]}:</strong> {m[2]}</> : text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// shows a value in the right style, based on field.type
function Cell({ field, value }) {
  if (!value) return null;
  if (field.type === "code") return <CodeBlock code={value} />;
  if (field.type === "list") return <Steps value={value} />;
  return <p className={`text ${field.type || ""}`}>{value}</p>;
}

/* =====================================================================
   5. SMALL COMPONENTS
   ===================================================================== */
// Know / Explained / Mastered. Click the active one again to clear it.
function MarkButtons({ value, onChange }) {
  return (
    <div className="marks">
      {STATUSES.map((s) => (
        <button
          key={s.id}
          className={`mark ${s.id} ${value === s.id ? "on" : ""}`}
          onClick={() => onChange(value === s.id ? null : s.id)}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  );
}

function Hero({ title, subtitle, counts, total }) {
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return (
    <header className="hero">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {counts && (
        <>
          <div className="hero-bar">
            <i className="k" style={{ width: `${pct(counts.know)}%` }} />
            <i className="e" style={{ width: `${pct(counts.explained)}%` }} />
            <i className="m" style={{ width: `${pct(counts.mastered)}%` }} />
          </div>
          <div className="hero-legend">🔵 {counts.know} &nbsp;·&nbsp; 🟡 {counts.explained} &nbsp;·&nbsp; 🟢 {counts.mastered}</div>
        </>
      )}
    </header>
  );
}

function Tabs({ active, onChange }) {
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button key={t.id} className={`tab ${active === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
          {t.icon} {t.label}
        </button>
      ))}
    </nav>
  );
}

// phone navigation, fixed at the bottom like a native app
function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button key={t.id} className={`bn ${active === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
          <span>{t.icon}</span>
          <span>{t.short}</span>
        </button>
      ))}
    </nav>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "know", label: "🔵 Know" },
  { id: "explained", label: "🟡 Explained" },
  { id: "mastered", label: "🟢 Mastered" },
];

function Toolbar({ query, onQuery, filter, onFilter, onShuffle, onReset }) {
  return (
    <div className="toolbar">
      <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="🔍  Search..." />
      <div className="chips">
        <button className="btn" onClick={onShuffle}>🔀 Shuffle</button>
        {FILTERS.map((f) => (
          <button key={f.id} className={`btn ${filter === f.id ? "active" : ""}`} onClick={() => onFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <button className="btn" onClick={onReset}>↺ Reset</button>
      </div>
    </div>
  );
}

/* =====================================================================
   6. LIST VIEWS  - table on desktop, expandable cards on phones
   ===================================================================== */
function ItemsTable({ category, items, marks, onMark }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{category.titleLabel}</th>
            {category.fields.map((f) => <th key={f.key}>{f.label}</th>)}
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const key = markKey(category.id, item.title);
            const status = marks[key] || "";
            const st = STATUSES.find((x) => x.id === status);
            return (
              <tr key={key} className={`st ${status}`}>
                <td className="num">{item.number}</td>
                <td className="title">
                  {item.title}
                  {st && <span className={`badge ${status}`}>{st.icon} {st.label}</span>}
                </td>
                {category.fields.map((f) => (
                  <td key={f.key} className={`t-${f.type || "text"}`}>
                    <Cell field={f} value={item[f.key]} />
                  </td>
                ))}
                <td className="progress-cell">
                  <MarkButtons value={status} onChange={(s) => onMark(key, s)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemCard({ category, item, status, onMark }) {
  const [open, setOpen] = useState(false);
  const preview = item[category.fields[0].key];
  const statusLabel = STATUSES.find((s) => s.id === status)?.label;
  const statusIcon = STATUSES.find((s) => s.id === status)?.icon;

  return (
    <article className={`m-card st ${status}`}>
      <button className="m-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="m-num">{item.number}</span>
        <span className="m-main">
          <span className="m-title">{item.title}</span>
          {!open && preview && <span className="m-preview">{preview}</span>}
        </span>
        <span className="m-side">
          {status && <span className={`badge ${status}`}>{statusIcon} {statusLabel}</span>}
          <span className={`chev ${open ? "up" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="m-body">
          {category.fields.map((f) =>
            item[f.key] ? (
              <section key={f.key} className="m-sec">
                <h4>{f.icon} {f.label}</h4>
                <Cell field={f} value={item[f.key]} />
              </section>
            ) : null
          )}
          <MarkButtons value={status} onChange={onMark} />
        </div>
      )}
    </article>
  );
}

/* =====================================================================
   7. PAGES
   ===================================================================== */
function Overview({ data, marks, onOpen }) {
  const rows = CATEGORIES.map((c) => {
    const items = data[c.id] || [];
    return { category: c, total: items.length, counts: countStatuses(items, c.id, marks) };
  });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const sum = (status) => rows.reduce((s, r) => s + r.counts[status], 0);
  const pct = (n, t) => (t ? (n / t) * 100 : 0);
  const mastered = total ? Math.round((sum("mastered") / total) * 100) : 0;

  return (
    <>
      <Hero title="My Concept Progress" subtitle={`${mastered}% mastered · ${total} items in total`}
            counts={{ know: sum("know"), explained: sum("explained"), mastered: sum("mastered") }} total={total} />

      <div className="stats">
        <div className="stat s-know">🔵 Know<b>{sum("know")}</b></div>
        <div className="stat s-explained">🟡 Explained<b>{sum("explained")}</b></div>
        <div className="stat s-mastered">🟢 Mastered<b>{sum("mastered")}</b></div>
      </div>

      {rows.map(({ category, total, counts }) => (
        <button key={category.id} className="row" onClick={() => onOpen(category.id)} style={{ "--accent": category.color }}>
          <span className="row-top">
            <span className="row-name">{category.icon} {category.label}</span>
            <span className="row-count">{total} items</span>
          </span>
          <span className="row-sub">🔵 {counts.know} &nbsp;·&nbsp; 🟡 {counts.explained} &nbsp;·&nbsp; 🟢 {counts.mastered} &nbsp;·&nbsp; {counts.none} not marked</span>
          <span className="progress">
            <i style={{ width: `${pct(counts.know, total)}%`, background: "var(--know)" }} />
            <i style={{ width: `${pct(counts.explained, total)}%`, background: "var(--explained)" }} />
            <i style={{ width: `${pct(counts.mastered, total)}%`, background: "var(--mastered)" }} />
          </span>
        </button>
      ))}
    </>
  );
}

function CategoryPage({ category, items, marks, onMark, onReset, isMobile }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [shuffled, setShuffled] = useState(null);

  // fixed number per item, so "#" stays the same after shuffle
  const numbered = useMemo(() => items.map((item, i) => ({ ...item, number: i + 1 })), [items]);

  const list = (shuffled || numbered).filter((item) => {
    const status = marks[markKey(category.id, item.title)] || "none";
    const okFilter = filter === "all" || status === filter;
    const okSearch = Object.values(item).join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return okFilter && okSearch;
  });

  const handleReset = () => {
    if (window.confirm("Reset all marks in this category?")) onReset();
  };

  return (
    <>
      <Hero title={`${category.icon} ${category.label}`} subtitle={`${items.length} items`}
            counts={countStatuses(items, category.id, marks)} total={items.length} />
      <Toolbar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter}
               onShuffle={() => setShuffled(shuffle(numbered))} onReset={handleReset} />

      {list.length === 0 ? (
        <p className="notice">🔍 No items match.</p>
      ) : isMobile ? (
        list.map((item) => {
          const key = markKey(category.id, item.title);
          return <ItemCard key={key} category={category} item={item} status={marks[key] || ""} onMark={(s) => onMark(key, s)} />;
        })
      ) : (
        <ItemsTable category={category} items={list} marks={marks} onMark={onMark} />
      )}
    </>
  );
}

/* =====================================================================
   8. APP
   ===================================================================== */
function Main() {
  const { data, marks, loading, error, setMark, resetCategory } = useConcepts();
  const [tab, setTab] = useState("overview");
  const isMobile = useIsMobile();

  const go = (id) => { setTab(id); window.scrollTo(0, 0); };
  const category = CATEGORIES.find((c) => c.id === tab);

  if (loading) return <p className="notice">Loading…</p>;

  return (
    <div className="wrap" style={{ "--accent": (category || OVERVIEW).color }}>
      <Tabs active={tab} onChange={go} />
      {error && <p className="notice error">{error}</p>}

      {category ? (
        // key={tab} resets search / filter / shuffle when you switch category
        <CategoryPage key={tab} category={category} items={data[tab] || []} marks={marks}
                      onMark={setMark} onReset={() => resetCategory(tab)} isMobile={isMobile} />
      ) : (
        <Overview data={data} marks={marks} onOpen={go} />
      )}

      <BottomNav active={tab} onChange={go} />
    </div>
  );
}

/* =====================================================================
   9. STYLES  - all CSS lives here, so the whole client is ONE file
   ===================================================================== */
const CSS = `
/* =============== BASE =============== */
:root {
  color-scheme: light dark;
  --text: #1e2433; --muted: #6b7280; --dark: #1f2937; --line: #e5e7eb; --card: #ffffff; --title: #6d28d9;
  --know: #3b82f6; --explained: #f5b800; --mastered: #22a559;
  --tint-know: #cfe1ff; --tint-explained: #ffe98f; --tint-mastered: #c4efd3;
  --accent: #6366f1;
  --quote-bg: #fdf2f8; --quote-fg: #831843; --warn-bg: #fee2e2; --warn-fg: #991b1b; --tip-bg: #fef9c3; --tip-fg: #713f12;
  --box-marked: #ffffffb3; --nav: #fffffff2; --navon-bg: #eef2ff; --navon-fg: #4f46e5;
  --bg: linear-gradient(135deg, #e0e7ff, #fce7f3 50%, #cffafe);
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #e8ebf4; --muted: #9aa4b8; --dark: #0b1020; --line: #2b3550; --card: #1a2133; --title: #c4b5fd;
    --tint-know: #1d4380; --tint-explained: #6b5200; --tint-mastered: #17603a;
    --quote-bg: #3a1a30; --quote-fg: #fbcfe8; --warn-bg: #44201f; --warn-fg: #fecaca; --tip-bg: #40380f; --tip-fg: #fde68a;
    --box-marked: #ffffff1a; --nav: #141a2cf2; --navon-bg: #2a2f6b; --navon-fg: #c7d2fe;
    --bg: linear-gradient(135deg, #0d1021, #1a1233 50%, #0a2030);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; min-height: 100vh; color: var(--text);
  font-family: Poppins, system-ui, sans-serif;
  background: var(--bg) fixed;
}
button, input { font-family: inherit; }
button { -webkit-tap-highlight-color: transparent; }
.wrap { width: 100%; padding: 20px 3vw; }
.notice { text-align: center; color: var(--muted); padding: 28px; }
.notice.error { color: #dc2626; }

/* =============== TOP TABS (desktop) =============== */
.tabs { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.tab { border: 0; background: var(--card); color: var(--muted); font: 600 16px Poppins, sans-serif; padding: 12px 22px; border-radius: 30px; cursor: pointer; box-shadow: 0 3px 10px #0001; transition: transform .15s; }
.tab:hover { transform: translateY(-3px); }
.tab.on { background: linear-gradient(90deg, #6366f1, #ec4899); color: #fff; box-shadow: 0 8px 20px #8b5cf688; }
.bottom-nav { display: none; }

/* =============== HERO =============== */
.hero { background: linear-gradient(120deg, var(--accent), #ec4899); color: #fff; text-align: center; padding: 30px 24px; border-radius: 28px; margin-bottom: 20px; box-shadow: 0 12px 28px #0002; }
.hero h1 { margin: 0 0 6px; font-size: 34px; font-weight: 800; }
.hero p { margin: 0; opacity: .92; font-size: 16px; }
.hero-bar { display: flex; height: 8px; max-width: 520px; margin: 18px auto 10px; border-radius: 8px; overflow: hidden; background: #ffffff40; }
.hero-bar i { display: block; height: 100%; }
.hero-bar .k { background: #60a5fa; } .hero-bar .e { background: #fde047; } .hero-bar .m { background: #4ade80; }
.hero-legend { font-size: 14px; font-weight: 600; }

/* =============== TOOLBAR =============== */
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
.toolbar input { flex: 1 1 220px; padding: 13px 18px; border-radius: 14px; border: 2px solid transparent; background: var(--card); color: var(--text); font: 500 15px Poppins, sans-serif; box-shadow: 0 3px 10px #0001; }
.toolbar input:focus { outline: none; border-color: var(--accent); }
.chips { display: flex; gap: 10px; flex-wrap: wrap; }
.btn { border: 0; background: var(--dark); color: #fff; font: 600 15px Poppins, sans-serif; padding: 12px 18px; border-radius: 14px; cursor: pointer; transition: transform .15s; white-space: nowrap; }
.btn:hover { transform: translateY(-2px); }
.btn.active { background: var(--accent); }

/* =============== OVERVIEW =============== */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 18px; }
.stat { border-radius: 22px; padding: 22px 24px; color: #fff; font-weight: 700; font-size: 18px; }
.stat b { display: block; font-size: 54px; line-height: 1.1; margin-top: 4px; }
.s-know { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.s-explained { background: linear-gradient(135deg, #facc15, #f97316); color: #4a2f00; }
.s-mastered { background: linear-gradient(135deg, #22c55e, #14b8a6); }
.row { display: block; width: 100%; text-align: left; border: 0; border-left: 6px solid var(--accent); background: var(--card); color: var(--text); border-radius: 20px; padding: 16px 20px; margin-bottom: 12px; cursor: pointer; box-shadow: 0 3px 10px #0001; transition: transform .2s; }
.row:hover { transform: translateX(6px); }
.row-top { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; }
.row-count { font-size: 13px; font-weight: 600; color: var(--muted); }
.row-sub { display: block; color: var(--muted); font-size: 13px; font-weight: 500; margin: 6px 0 12px; }
.progress { display: flex; height: 10px; border-radius: 10px; background: var(--line); overflow: hidden; }
.progress i { display: block; height: 100%; }

/* =============== CONTENT BLOCKS =============== */
.text { margin: 0; line-height: 1.65; }
.text.quote { padding: 12px 14px; border-left: 4px solid var(--st, #ec4899); background: var(--box, var(--quote-bg)); border-radius: 0 12px 12px 0; font-style: italic; color: var(--boxtext, var(--quote-fg)); }
.text.warn  { padding: 12px 14px; background: var(--box, var(--warn-bg)); color: var(--boxtext, var(--warn-fg)); border-radius: 12px; }
.text.tip   { padding: 12px 14px; background: var(--box, var(--tip-bg)); color: var(--boxtext, var(--tip-fg)); border-radius: 12px; font-weight: 600; }

.steps { list-style: none; margin: 0; padding: 0; counter-reset: n; }
.steps li { display: flex; gap: 12px; margin-bottom: 10px; counter-increment: n; line-height: 1.6; }
.steps li:last-child { margin-bottom: 0; }
.steps li::before { content: counter(n); flex: 0 0 24px; height: 24px; margin-top: 2px; border-radius: 50%; background: var(--st, var(--c, var(--accent))); color: #fff; font: 700 12px/24px Poppins, sans-serif; text-align: center; }
.steps li span { flex: 1; min-width: 0; overflow-wrap: anywhere; }

.code { border-radius: 14px; overflow: hidden; background: #0b1220; border: 1px solid var(--st, #1e293b); }
.code-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #111a2e; color: #94a3b8; font: 600 11px Poppins, sans-serif; letter-spacing: .6px; text-transform: uppercase; }
.code-bar button { border: 0; background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 6px 12px; font: 600 12px Poppins, sans-serif; cursor: pointer; }
.code pre { margin: 0; padding: 12px 0; overflow-x: auto; -webkit-overflow-scrolling: touch; color: #e2e8f0; counter-reset: ln; font: 400 13px/1.75 "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; }
.code .ln { display: block; min-width: max-content; min-height: 1.75em; padding-right: 16px; white-space: pre; counter-increment: ln; }
.code .ln::before { content: counter(ln); display: inline-block; width: 32px; margin-right: 12px; text-align: right; color: #475569; user-select: none; }
.tk-kw { color: #c4b5fd; } .tk-str { color: #fbbf24; } .tk-num { color: #7dd3fc; } .tk-cm { color: #64748b; font-style: italic; }

/* =============== MARKED ITEMS: the whole item takes the status colour =============== */
.st.know      { --st: #3b82f6; --box: var(--box-marked); --boxtext: var(--text); }
.st.explained { --st: #c98a00; --box: var(--box-marked); --boxtext: var(--text); }
.st.mastered  { --st: #22a559; --box: var(--box-marked); --boxtext: var(--text); }
tbody td, .m-card { transition: background .25s; }

/* =============== TABLE (desktop) =============== */
.table-wrap { background: var(--card); border-radius: 24px; overflow: auto; max-height: calc(100vh - 360px); min-height: 300px; box-shadow: 0 8px 24px #0002; }
table { border-collapse: collapse; width: 100%; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--dark); color: #fff; text-align: left; font-weight: 700; padding: 20px 16px; white-space: nowrap; border-bottom: 5px solid; }
thead th:nth-child(6n+1) { border-color: #6366f1; } thead th:nth-child(6n+2) { border-color: #ec4899; }
thead th:nth-child(6n+3) { border-color: #f97316; } thead th:nth-child(6n+4) { border-color: #14b8a6; }
thead th:nth-child(6n+5) { border-color: #facc15; } thead th:nth-child(6n)   { border-color: #3b82f6; }
tbody td { padding: 16px; vertical-align: top; font-size: 15px; min-width: 200px; border-bottom: 1px solid var(--line); }
tbody td.t-code { min-width: 360px; }
tbody td.t-list { min-width: 270px; }
tbody td:nth-child(6n+3) { --c: #6366f1; } tbody td:nth-child(6n+4) { --c: #ec4899; }
tbody td:nth-child(6n+5) { --c: #f97316; } tbody td:nth-child(6n+6) { --c: #14b8a6; }
tbody td:nth-child(6n+1) { --c: #3b82f6; } tbody td:nth-child(6n+2) { --c: #8b5cf6; }
td.num { min-width: 50px; font-weight: 800; color: var(--muted); }
td.title { min-width: 180px; font-weight: 800; font-size: 17px; color: var(--title); }
td.progress-cell { min-width: 150px; }
td.title .badge { display: table; margin-top: 8px; font-size: 11px; }
tr.know td { background: var(--tint-know) !important; } tr.explained td { background: var(--tint-explained) !important; } tr.mastered td { background: var(--tint-mastered) !important; }
tr.know td.num { box-shadow: inset 8px 0 var(--know); }
tr.explained td.num { box-shadow: inset 8px 0 var(--explained); }
tr.mastered td.num { box-shadow: inset 8px 0 var(--mastered); }

/* =============== MARK BUTTONS =============== */
.marks { display: flex; flex-direction: column; gap: 6px; }
.mark { border: 2px solid var(--line); background: var(--card); color: var(--text); font: 600 13px Poppins, sans-serif; padding: 8px 12px; border-radius: 12px; cursor: pointer; transition: transform .15s; }
.mark:hover { transform: scale(1.05); }
.mark.on.know { background: var(--know); border-color: var(--know); color: #fff; }
.mark.on.explained { background: var(--explained); border-color: var(--explained); color: #3a2600; }
.mark.on.mastered { background: var(--mastered); border-color: var(--mastered); color: #fff; }

/* =============== PHONE CARDS =============== */
.m-card { background: var(--card); border-radius: 20px; margin-bottom: 12px; overflow: hidden; border-left: 6px solid var(--line); box-shadow: 0 4px 16px #0f172a1a; }
.m-card.know { border-left-color: var(--know); background: var(--tint-know) !important; }
.m-card.explained { border-left-color: var(--explained); background: var(--tint-explained) !important; }
.m-card.mastered { border-left-color: var(--mastered); background: var(--tint-mastered) !important; }
.m-card.know .m-body, .m-card.explained .m-body, .m-card.mastered .m-body { border-top-color: #7f8ba040; }
.m-head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.m-num { flex: 0 0 34px; height: 34px; border-radius: 11px; background: var(--accent); color: #fff; font: 700 13px/34px Poppins, sans-serif; text-align: center; }
.m-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.m-title { font-weight: 700; font-size: 16px; line-height: 1.3; }
.m-preview { font-size: 13px; line-height: 1.45; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.m-side { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }
.badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fff; }
.badge.know { background: var(--know); } .badge.explained { background: var(--explained); color: #3a2600; } .badge.mastered { background: var(--mastered); }
.chev { width: 9px; height: 9px; border-right: 2.5px solid var(--muted); border-bottom: 2.5px solid var(--muted); transform: rotate(45deg); margin-bottom: 3px; transition: transform .2s; }
.chev.up { transform: rotate(-135deg); margin-bottom: -3px; }
.m-body { padding: 2px 16px 18px; border-top: 1px solid var(--line); }
.m-sec { padding: 16px 0; border-bottom: 1px dashed var(--line); }
.m-sec h4 { margin: 0 0 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--accent); }
.m-sec .text { font-size: 15px; }
.m-body .marks { flex-direction: row; gap: 8px; margin-top: 18px; }
.m-body .mark { flex: 1; height: 46px; padding: 0 4px; font-size: 13px; border-radius: 14px; }

/* =============== PHONE LAYOUT =============== */
@media (max-width: 768px) {
  .wrap { padding: calc(12px + env(safe-area-inset-top, 0px)) 14px calc(96px + env(safe-area-inset-bottom, 0px)); }
  .tabs { display: none; }

  .bottom-nav {
    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
    background: var(--nav); backdrop-filter: blur(14px); border-top: 1px solid var(--line);
    box-shadow: 0 -6px 20px #0f172a14;
  }
  .bn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 0; border: 0; border-radius: 14px; background: none; color: var(--muted); font: 600 10.5px Poppins, sans-serif; }
  .bn span:first-child { font-size: 20px; line-height: 1.2; }
  .bn.on { background: var(--navon-bg); color: var(--navon-fg); }

  .hero { padding: 20px 16px; border-radius: 22px; margin-bottom: 14px; }
  .hero h1 { font-size: 22px; }
  .hero p { font-size: 14px; }
  .hero-bar { margin: 14px auto 8px; }
  .hero-legend { font-size: 13px; }

  .toolbar { flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .toolbar input { flex: none; width: 100%; font-size: 16px; padding: 14px 16px; }
  .chips { flex-wrap: nowrap; overflow-x: auto; margin: 0 -14px; padding: 2px 14px 6px; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .btn { flex: 0 0 auto; padding: 11px 16px; font-size: 14px; }

  .stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat { padding: 14px 8px; font-size: 13px; text-align: center; border-radius: 18px; }
  .stat b { font-size: 30px; }
  .row { padding: 14px 16px; }
  .row-top { font-size: 16px; }
}
`;

/* =====================================================================
   10. START
   ===================================================================== */
export default function App() {
  useEffect(() => {
    [["darkreader-lock", ""], ["color-scheme", "light dark"]].forEach(([name, content]) => {
      if (document.querySelector(`meta[name="${name}"]`)) return;
      const tag = document.createElement("meta");
      tag.name = name; tag.content = content;
      document.head.appendChild(tag);
    });
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <Main />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
