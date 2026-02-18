// ---------- Data paths ----------
const STATS = "data/stats.json";
const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";

function el(id){ return document.getElementById(id); }

async function loadJson(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`Fetch failed: ${path} ${r.status}`);
  return r.json();
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatPct(p){
  if(p === null || p === undefined) return "—";
  return `${p}%`;
}

function formatDateISO(s){
  if(!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR");
}

// ---------- System filters (NE PAS AFFICHER) ----------
const SYSTEM_KEYS = new Set([
  "_missing","_id","_uuid","_index","_submission_time","_submitted_by",
  "_validation_status","_notes","formhub/uuid","_attachments"
]);

function isSystemKey(k){
  if(k === null || k === undefined) return true;
  const s = String(k).trim();
  if(!s) return true;
  if(SYSTEM_KEYS.has(s)) return true;
  if(s.startsWith("_")) return true;
  return false;
}

function cleanLabel(k){
  if(isSystemKey(k)) return null;
  return String(k).trim();
}

function headerLabel(c){
  // rendre lisible (sans jargon système)
  return String(c).replaceAll("_"," ").replaceAll("/"," • ");
}

// ---------- Percent computation ----------
function totalFromCounter(counterObj){
  const c = counterObj || {};
  return Object.entries(c).reduce((acc,[k,v]) => (k==="_missing"?acc:acc+Number(v||0)), 0);
}

function toPercentDataSmart(counterObj, q){
  const labelMap = q?.label_map || {};
  const hidden = new Set([...(q?.hide || []), "_missing"]);

  const total = totalFromCounter(counterObj);
  if(!total) return { labels: [], values: [] };

  let entries = Object.entries(counterObj || {})
    .filter(([k]) => !hidden.has(k))
    .map(([k,v]) => {
      const cl = cleanLabel(k);
      if(!cl) return null;
      const pct = Math.round((Number(v||0) / total) * 100);
      return [labelMap[k] ?? cl, pct];
    })
    .filter(Boolean);

  entries.sort((a,b)=>b[1]-a[1]);

  // top N (par défaut 10 si non fourni)
  const top = (q?.top ?? 10);
  entries = entries.slice(0, top);

  return { labels: entries.map(e=>e[0]), values: entries.map(e=>e[1]) };
}

// ---------- Chart.js modern ----------
function applyModernChartDefaults(){
  if(!window.Chart) return;
  Chart.defaults.font.family = "Segoe UI, Inter, system-ui, -apple-system, Arial";
  Chart.defaults.color = "#334155";
  Chart.defaults.animation.duration = 350;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
}

function modernOptions(extra = {}){
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      tooltip: {
        intersect: false,
        mode: "nearest",
        callbacks: { label: (ctx) => `${ctx.raw}%` }
      }
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: { color: "rgba(15,23,42,0.06)" },
        border: { display: false },
        ticks: { callback: (v)=>`${v}%` }
      },
      y: {
        grid: { display: false },
        border: { display: false }
      }
    },
    elements: {
      bar: { borderRadius: 10, borderSkipped: false }
    }
  };

  return Object.assign({}, base, extra, {
    plugins: Object.assign({}, base.plugins, extra.plugins || {}),
    scales: Object.assign({}, base.scales, extra.scales || {})
  });
}

function createPercentBarChart(canvasId, labels, values, title){
  const c = document.getElementById(canvasId);
  if(!c || !window.Chart) return null;

  if(c._chart){
    try{ c._chart.destroy(); } catch(e){}
    c._chart = null;
  }

  const chart = new Chart(c, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: title, data: values, borderWidth: 0 }]
    },
    options: modernOptions()
  });

  c._chart = chart;
  return chart;
}

// ---------- KPI helper ----------
function pctFromCounter(counterObj, key){
  const c = counterObj || {};
  const total = Object.entries(c).reduce((acc,[k,v]) => (k==="_missing"?acc:acc+Number(v||0)), 0);
  if(!total) return null;
  const val = Number(c[key] || 0);
  return Math.round((val/total)*100);
}

// ---------- Dashboard ----------
function buildDashboard(stats, questions){
  const sectionsDiv = el("dashboardSections");
  if(!sectionsDiv) return;

  const counters = stats.counters || {};
  const multi = stats.multi || {};

  // KPI
  const n = stats.n ?? 0;
  if(el("kpiN")) el("kpiN").textContent = n;

  if(el("kpiFormation")) el("kpiFormation").textContent = formatPct(pctFromCounter(counters["sec1/formation_genre"], "Oui"));
  if(el("kpiCellule")) el("kpiCellule").textContent = formatPct(pctFromCounter(counters["sec3/cellule_genre"], "Oui"));
  if(el("kpiPol")) el("kpiPol").textContent = formatPct(pctFromCounter(counters["sec2/politiques_genre_connaissance"], "Oui"));

  // Group questions by section
  const bySection = new Map();
  for(const q of questions){
    if(!bySection.has(q.section)) bySection.set(q.section, []);
    bySection.get(q.section).push(q);
  }

  const sectionOrder = Array.from(bySection.keys());

  // Render section blocks
  sectionsDiv.innerHTML = sectionOrder.map(sec => {
    const items = bySection.get(sec);
    const cards = items.map((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
      return `
        <div class="chartCard col-6">
          <h3>${escapeHtml(q.title)}</h3>
          <canvas id="${chartId}"></canvas>
          <div class="subhead" style="margin-top:8px;">% des réponses • top ${escapeHtml(q.top ?? 10)}</div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-top:14px;">
        <div class="sectionTitle">
          <div><h2 style="margin:0">${escapeHtml(sec)}</h2></div>
          <span class="sectionChip">Section</span>
        </div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("");

  // Create charts (smart % horizontal)
  sectionOrder.forEach(sec => {
    const items = bySection.get(sec);
    items.forEach((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;

      // source: multi fields in stats.multi, otherwise stats.counters
      const source = (q.chart === "bar_multi") ? (multi[q.field] || {}) : (counters[q.field] || {});
      const d = toPercentDataSmart(source, q);

      if(!d.labels.length){
        createPercentBarChart(chartId, ["—"], [0], q.title);
      } else {
        createPercentBarChart(chartId, d.labels, d.values, q.title);
      }
    });
  });
}

// ---------- Table (Responses) ----------
function buildTable(rows){
  const thead = el("thead");
  const tbody = el("tbody");
  const search = el("searchTable");
  if(!thead || !tbody) return;

  // remove system columns
  const cols = rows.length ? Object.keys(rows[0]).filter(c => !isSystemKey(c)) : [];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(headerLabel(c))}</th>`).join("")}</tr>`;

  const render = (data) => {
    tbody.innerHTML = data.map(r => {
      return `<tr>${cols.map(c => {
        const v = r[c];
        const isEmpty = (v === null || v === undefined || String(v).trim() === "");
        return isEmpty ? `<td class="muted">—</td>` : `<td>${escapeHtml(v)}</td>`;
      }).join("")}</tr>`;
    }).join("");
  };

  render(rows);

  if(search){
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      if(!q) return render(rows);
      const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      render(filtered);
    });
  }
}

// ---------- Recommendations (global) ----------
function buildGlobalRecos(payload){
  if(el("sigCellule")) el("sigCellule").textContent = formatPct(payload?.signals?.cellule_genre_oui_pct);
  if(el("sigPlan")) el("sigPlan").textContent = formatPct(payload?.signals?.plan_action_oui_pct);
  if(el("sigInd")) el("sigInd").textContent = formatPct(payload?.signals?.indicateurs_oui_pct);
  if(el("sigOutils")) el("sigOutils").textContent = formatPct(payload?.signals?.outils_oui_pct);

  // Charts as % (horizontal)
  const obstacles = payload?.top_obstacles || [];
  const actions = payload?.top_actions || [];

  // Obstacles -> % within listed items
  const oTotal = obstacles.reduce((a,x)=>a+Number(x.count||0),0) || 1;
  const oLabels = obstacles.map(x => x.label).filter(l => !isSystemKey(l));
  const oValsPct = obstacles.slice(0, oLabels.length).map(x => Math.round((Number(x.count||0)/oTotal)*100));
  createPercentBarChart("chartTopObstacles", oLabels, oValsPct, "Top obstacles (%)");

  // Actions -> % within listed items
  const aTotal = actions.reduce((a,x)=>a+Number(x.count||0),0) || 1;
  const aLabels = actions.map(x => x.label).filter(l => !isSystemKey(l));
  const aValsPct = actions.slice(0, aLabels.length).map(x => Math.round((Number(x.count||0)/aTotal)*100));
  createPercentBarChart("chartTopActions", aLabels, aValsPct, "Top actions (%)");

  const ul = el("globalRecos");
  if(ul){
    ul.innerHTML = (payload?.recommendations || [])
      .filter(x => !isSystemKey(x))
      .map(x => `<li>${escapeHtml(x)}</li>`)
      .join("");
  }
}

// ---------- Meta ----------
function setMetaFromStats(stats){
  const nEl = el("nResponses");
  if(nEl && (stats?.n !== null && stats?.n !== undefined)) nEl.textContent = stats.n;

  const generated = stats?.generated_at || stats?.meta?.generated_at || null;
  const last = el("lastUpdate");
  if(last) last.textContent = formatDateISO(generated || new Date().toISOString());
}

// ---------- Main ----------
async function main(){
  applyModernChartDefaults();
  const page = document.body.getAttribute("data-page");

  if(page === "dashboard"){
    const [stats, questions] = await Promise.all([loadJson(STATS), loadJson(QUESTIONS)]);
    setMetaFromStats(stats);
    buildDashboard(stats, questions);
    return;
  }

  if(page === "responses"){
    const [stats, rows] = await Promise.all([loadJson(STATS), loadJson(TABLE)]);
    setMetaFromStats(stats);
    buildTable(rows);
    return;
  }

  if(page === "recommendations"){
    const [stats, recos] = await Promise.all([loadJson(STATS), loadJson(RECOS)]);
    setMetaFromStats(stats);
    buildGlobalRecos(recos);
    return;
  }
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
