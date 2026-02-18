// ---------- Data paths ----------
const STATS = "data/stats.json";
const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";
const ANALYSIS = "data/analysis_recos.json";

function el(id){ return document.getElementById(id); }

async function loadJson(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`Fetch failed: ${path} ${r.status}`);
  return r.json();
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

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- System filters ----------
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

function headerLabel(c){
  // Avoid "mots systèmes" and make headers human-friendly
  const s = String(c);
  return s.replaceAll("_"," ").replaceAll("/"," • ");
}

// ---------- Counters -> chart data ----------
function toChartData(counterObj){
  const entries = Object.entries(counterObj || {}).filter(([k]) => k !== "_missing");
  entries.sort((a,b) => b[1]-a[1]);
  return { labels: entries.map(e=>e[0]), values: entries.map(e=>e[1]) };
}

function toTop(counterObj, n=8){
  const d = toChartData(counterObj);
  return { labels: d.labels.slice(0,n), values: d.values.slice(0,n) };
}

// Semantic layer: labels map + hide + top
function cleanLabel(k){
  if(isSystemKey(k)) return null;
  return String(k).trim();
}

function toChartDataSmart(counterObj, q){
  const labelMap = q?.label_map || {};
  const hidden = new Set([...(q?.hide || []), "_missing"]);

  let entries = Object.entries(counterObj || {})
    .filter(([k]) => !hidden.has(k))
    .map(([k,v]) => {
      const cl = cleanLabel(k);
      if(!cl) return null;
      return [labelMap[k] ?? cl, v];
    })
    .filter(Boolean);

  entries.sort((a,b)=>b[1]-a[1]);

  const top = q?.top ?? null;
  if(top) entries = entries.slice(0, top);

  return { labels: entries.map(e=>e[0]), values: entries.map(e=>e[1]) };
}

// ---------- Chart.js modern layer ----------
function applyModernChartDefaults(){
  if(!window.Chart) return;

  Chart.defaults.font.family = "Segoe UI, Inter, system-ui, -apple-system, Arial";
  Chart.defaults.color = "#334155";
  Chart.defaults.animation.duration = 450;

  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
}

function modernOptions(extra = {}){
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 6, right: 10, bottom: 0, left: 6 } },
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: "index" }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { maxRotation: 0, autoSkip: true }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(15,23,42,0.06)", drawBorder: false },
        border: { display: false },
        ticks: { precision: 0 }
      }
    },
    elements: {
      bar: { borderRadius: 10, borderSkipped: false },
      line: { tension: 0.35, borderWidth: 2 },
      point: { radius: 3, hoverRadius: 5 }
    }
  };

  return Object.assign({}, base, extra, {
    plugins: Object.assign({}, base.plugins, extra.plugins || {}),
    scales: Object.assign({}, base.scales, extra.scales || {})
  });
}

function createChart(canvasId, labels, values, title, type="bar", opts={}){
  const c = document.getElementById(canvasId);
  if(!c || !window.Chart) return null;

  // destroy existing chart on same canvas
  if(c._chart){
    try{ c._chart.destroy(); } catch(e){}
    c._chart = null;
  }

  const dataset = {
    label: title,
    data: values,
    borderWidth: (type === "line") ? 2 : 0
  };

  const isDoughnut = (type === "doughnut" || type === "pie");
  const options = isDoughnut
    ? modernOptions({
        plugins: { legend: { display: true, position: "bottom" } },
        cutout: type === "doughnut" ? "62%" : undefined
      })
    : modernOptions(opts);

  const chart = new Chart(c, {
    type,
    data: { labels, datasets: [dataset] },
    options
  });

  c._chart = chart;
  return chart;
}

// ---------- KPI helpers ----------
function pctFromCounter(counterObj, key){
  const c = counterObj || {};
  const total = Object.entries(c).reduce((acc,[k,v]) => (k==="_missing"?acc:acc+v), 0);
  if(!total) return null;
  const val = c[key] || 0;
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

  // Render placeholders
  sectionsDiv.innerHTML = sectionOrder.map(sec => {
    const items = bySection.get(sec);
    const cards = items.map((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
      return `
        <div class="chartCard col-6">
          <h3>${escapeHtml(q.title)}</h3>
          <canvas id="${chartId}"></canvas>
          <div class="small">Variable: <code>${escapeHtml(q.field)}</code></div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-top:14px;">
        <div class="sectionTitle">
          <div>
            <h2 style="margin:0">${escapeHtml(sec)}</h2>
          </div>
          <span class="sectionChip">Section</span>
        </div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("");

  // Create charts after DOM injection (semantic layer)
  sectionOrder.forEach(sec => {
    const items = bySection.get(sec);
    items.forEach((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;

      const source =
        (q.chart === "bar_multi") ? (multi[q.field] || {}) :
        (counters[q.field] || {});

      const d = toChartDataSmart(source, q);

      const chartType =
        (q.chart === "donut") ? "doughnut" :
        (q.chart === "bar_h") ? "bar" :
        "bar";

      const opts = (q.chart === "bar_h") ? { indexAxis: "y" } : {};

      // fallback: if no labels, avoid error
      if(!d.labels.length){
        createChart(chartId, ["—"], [0], q.title, "bar");
      } else {
        createChart(chartId, d.labels, d.values, q.title, chartType, opts);
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

  const cols = rows.length
    ? Object.keys(rows[0]).filter(c => !isSystemKey(c))
    : [];

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

  const obstacles = payload?.top_obstacles || [];
  const actions = payload?.top_actions || [];

  const oLabels = obstacles.map(x => x.label);
  const oVals = obstacles.map(x => x.count);
  createChart("chartTopObstacles", oLabels, oVals, "Top obstacles", "bar", { indexAxis: "y" });

  const aLabels = actions.map(x => x.label);
  const aVals = actions.map(x => x.count);
  createChart("chartTopActions", aLabels, aVals, "Top actions", "bar", { indexAxis: "y" });

  const ul = el("globalRecos");
  if(ul){
    ul.innerHTML = (payload?.recommendations || [])
      .map(x => `<li>${escapeHtml(x)}</li>`)
      .join("");
  }
}

// ---------- Analysis & recos (analysis.html) ----------
function asCounter(objOrArr){
  // Accept dict {label:count} or array [{label,count}] or array of strings
  if(Array.isArray(objOrArr)){
    // array of {label,count}
    if(objOrArr.length && typeof objOrArr[0] === "object"){
      const out = {};
      for(const x of objOrArr){
        const k = x.label ?? x.name ?? x.key;
        const v = x.count ?? x.value ?? 0;
        if(k) out[k] = (out[k] || 0) + Number(v || 0);
      }
      return out;
    }
    // array of strings
    const out = {};
    for(const s of objOrArr){
      if(!s) continue;
      out[s] = (out[s] || 0) + 1;
    }
    return out;
  }
  if(objOrArr && typeof objOrArr === "object") return objOrArr;
  return {};
}

function buildAnalysis(payload){
  // Meta
  if(el("nResponses")){
    const n = payload?.n ?? payload?.meta?.n ?? payload?.total ?? null;
    if(n !== null && n !== undefined) el("nResponses").textContent = n;
  }

  // Distributions: try multiple plausible keys
  const scoreDist =
    payload?.score_dist || payload?.score_distribution || payload?.distributions?.score || payload?.dist?.score || {};
  const priorityDist =
    payload?.priority_dist || payload?.priority_distribution || payload?.distributions?.priority || payload?.dist?.priority || {};

  const s = toChartDataSmart(asCounter(scoreDist), { hide: ["_missing"], top: 20 });
  const p = toChartDataSmart(asCounter(priorityDist), { hide: ["_missing"], top: 20 });

  if(el("chartScoreDist")){
    createChart("chartScoreDist", s.labels.length ? s.labels : ["—"], s.values.length ? s.values : [0], "Score maturité", "bar");
  }
  if(el("chartPriorityDist")){
    createChart("chartPriorityDist", p.labels.length ? p.labels : ["—"], p.values.length ? p.values : [0], "Priorité d’actions", "bar", { indexAxis: "y" });
  }

  // Table rows
  const rows =
    payload?.rows || payload?.table || payload?.by_respondent || payload?.records || payload?.items || [];

  const thead = el("theadAnalysis");
  const tbody = el("tbodyAnalysis");
  const search = el("searchAnalysis");

  if(thead && tbody && Array.isArray(rows)){
    const cols = rows.length
      ? Object.keys(rows[0]).filter(c => !isSystemKey(c))
      : [];

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

  // Top gaps + global recos (robust keys)
  const gaps =
    payload?.top_gaps || payload?.gaps_top || payload?.gaps || payload?.insights?.top_gaps || [];

  const topGapsDiv = el("topGaps");
  if(topGapsDiv){
    const gCounter = asCounter(gaps);
    const gd = toTop(gCounter, 8);
    topGapsDiv.innerHTML = gd.labels.map((lab, i) => `
      <div>
        <span>${escapeHtml(lab)}</span>
        <span class="muted">${gd.values[i]}</span>
      </div>
    `).join("");
  }

  const recos =
    payload?.global_recommendations || payload?.recommendations || payload?.plan || payload?.insights?.recommendations || [];

  const ul = el("globalRecos");
  if(ul && Array.isArray(recos)){
    ul.innerHTML = recos.map(x => `<li>${escapeHtml(x)}</li>`).join("");
  }
}

// ---------- Global meta ----------
function setMetaFromStats(stats){
  const nEl = el("nResponses");
  if(nEl && (stats?.n !== null && stats?.n !== undefined)) nEl.textContent = stats.n;

  // Prefer generated timestamp if present; else show now
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

  if(page === "analysis"){
    const [stats, analysis] = await Promise.all([loadJson(STATS), loadJson(ANALYSIS)]);
    setMetaFromStats(stats);
    buildAnalysis(analysis);
    return;
  }
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
