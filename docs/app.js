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

function toChartData(counterObj){
  const entries = Object.entries(counterObj || {}).filter(([k]) => k !== "_missing");
  entries.sort((a,b) => b[1]-a[1]);
  return { labels: entries.map(e=>e[0]), values: entries.map(e=>e[1]) };
}

function toTop(counterObj, n=8){
  const d = toChartData(counterObj);
  return { labels: d.labels.slice(0,n), values: d.values.slice(0,n) };
}

function createChart(canvasId, labels, values, title, type="bar"){
  const c = document.getElementById(canvasId);
  if(!c) return null;
  return new Chart(c, {
    type,
    data: { labels, datasets: [{ label: title, data: values }] },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales: type === "bar" ? { y:{ beginAtZero:true, ticks:{ precision:0 } } } : {}
    }
  });
}

function pctFromCounter(counterObj, key){
  const c = counterObj || {};
  const total = Object.entries(c).reduce((acc,[k,v]) => (k==="_missing"?acc:acc+v), 0);
  if(!total) return null;
  const val = c[key] || 0;
  return Math.round((val/total)*100);
}

/* ---------------- Dashboard ---------------- */
function buildDashboard(stats, questions){
  const sectionsDiv = el("dashboardSections");
  if(!sectionsDiv) return;

  const counters = stats.counters || {};
  const multi = stats.multi || {};

  // KPI
  const n = stats.n ?? 0;
  el("kpiN").textContent = n;

  el("kpiFormation").textContent = formatPct(pctFromCounter(counters["sec1/formation_genre"], "Oui"));
  el("kpiCellule").textContent = formatPct(pctFromCounter(counters["sec3/cellule_genre"], "Oui"));
  el("kpiPol").textContent = formatPct(pctFromCounter(counters["sec2/politiques_genre_connaissance"], "Oui"));

  // Group questions by section
  const bySection = new Map();
  for(const q of questions){
    if(!bySection.has(q.section)) bySection.set(q.section, []);
    bySection.get(q.section).push(q);
  }

  // Render sections in order of appearance
  const sectionOrder = Array.from(bySection.keys());
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
          <h2 style="margin:0">${escapeHtml(sec)}</h2>
          <span class="sectionChip">Section</span>
        </div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("");

  // Create charts after DOM injection
  sectionOrder.forEach(sec => {
    const items = bySection.get(sec);
    items.forEach((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
      if(q.chart === "bar_multi"){
        const d = toTop(multi[q.field] || {}, 10);
        createChart(chartId, d.labels, d.values, q.title, "bar");
      } else {
        const d = toChartData(counters[q.field] || {});
        const chartType = (q.chart === "donut") ? "doughnut" : "bar";
        createChart(chartId, d.labels, d.values, q.title, chartType);
      }
    });
  });
}

/* ---------------- Table ---------------- */
function buildTable(rows){
  const thead = el("thead");
  const tbody = el("tbody");
  const search = el("searchTable");
  if(!thead || !tbody) return;

  const cols = rows.length ? Object.keys(rows[0]) : [];
  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;

  const render = (data) => {
    tbody.innerHTML = data.map(r => {
      return `<tr>${cols.map(c => `<td>${escapeHtml(r[c] ?? "")}</td>`).join("")}</tr>`;
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

/* ---------------- Recommendations (global) ---------------- */
function buildGlobalRecos(payload){
  if(el("sigCellule")) el("sigCellule").textContent = formatPct(payload.signals.cellule_genre_oui_pct);
  if(el("sigPlan")) el("sigPlan").textContent = formatPct(payload.signals.plan_action_oui_pct);
  if(el("sigInd")) el("sigInd").textContent = formatPct(payload.signals.indicateurs_oui_pct);
  if(el("sigOutils")) el("sigOutils").textContent = formatPct(payload.signals.outils_oui_pct);

  const obstacles = payload.top_obstacles || [];
  const actions = payload.top_actions || [];

  const oLabels = obstacles.map(x => x.label);
  const oVals = obstacles.map(x => x.count);
  createChart("chartTopObstacles", oLabels, oVals, "Top obstacles", "bar");

  const aLabels = actions.map(x => x.label);
  const aVals = actions.map(x => x.count);
  createChart("chartTopActions", aLabels, aVals, "Top actions", "bar");

  const ul = el("globalRecos");
  if(ul){
    ul.innerHTML = (payload.recommendations || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
  }
}

/* ---------------- Global Meta ---------------- */
function setMetaFromStats(stats){
  const nEl = el("nResponses");
  if(nEl) nEl.textContent = stats.n ?? "—";
  // no reliable generated_at in stats; show now
  const last = el("lastUpdate");
  if(last) last.textContent = formatDateISO(new Date().toISOString());
}

async function main(){
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
