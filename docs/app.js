// ===============================
// Enquête Genre RDC — APP (Robuste)
// Aligné sur colonnes "humaines" (Ministere, Sexe, etc.)
// + UN Blue/Orange charts + % labels
// ===============================

const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";   // optionnel
const STATS = "data/stats.json";                    // optionnel

function el(id){ return document.getElementById(id); }

async function loadJson(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`Fetch failed ${r.status} — ${path}`);
  return r.json();
}

function unwrapArray(payload){
  if(Array.isArray(payload)) return payload;
  if(payload && Array.isArray(payload.data)) return payload.data;
  if(payload && Array.isArray(payload.results)) return payload.results;
  return null;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalize(v){
  if(v === null || v === undefined) return "";
  return String(v).trim();
}

function formatDateISO(s){
  if(!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR");
}

function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b,"fr"));
}

function buildSelect(selectEl, values, allLabel="Tous"){
  if(!selectEl) return;
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "__all__";
  optAll.textContent = allLabel;
  selectEl.appendChild(optAll);
  values.forEach(v=>{
    const o=document.createElement("option");
    o.value=v; o.textContent=v;
    selectEl.appendChild(o);
  });
}

// ---------- Multi-select split (gère " • " + ; , | newline) ----------
function splitMulti(val){
  const s = normalize(val);
  if(!s) return [];
  if(/[•;,|\n]/.test(s)){
    return s
      .split(/[•;,|\n]+/)
      .map(x=>x.trim())
      .filter(Boolean);
  }
  return [s];
}

// ---------- Colonnes réelles ----------
const COL = {
  ministere: "Ministere",
  sexe: "Sexe",
  fonction: "Fonction",
  experience: "Expérience (ministère)",
  formation: "Formation genre",

  comprehension: "Compréhension du genre",
  diffSexeGenre: "Différence sexe/genre",
  genreBio: "« Genre = biologique »",
  connaitPolitique: "Connaît politique genre",
  genreImportantPP: "Genre important en politiques publiques",

  celluleGenre: "Cellule genre",
  planGenre: "Plan/stratégie genre",
  indicateurs: "Indicateurs sensibles au genre",
  outils: "Outils/guide genre",
  freqFormations: "Fréquence formations genre",

  genreImportantSecteur: "Genre important pour le secteur",
  obstacles: "Obstacles (libellés)",
  actions: "Actions prioritaires (libellés)",

  gtg: "Connaissance GTG",
  sousGroupes: "Sous-groupes GTG connus",

  recoVerbatim: "Recommandations (verbatim)"
};

// ---------- System keys ----------
function isSystemKey(k){
  const s = String(k ?? "").trim();
  if(!s) return true;
  if(s.startsWith("_")) return true;
  return false;
}
function headerLabel(c){
  return String(c).replaceAll("_"," ").replaceAll("/"," • ");
}

// ---------- Filters ----------
function getCurrentFilters(){
  return {
    ministere: el("fMinistere")?.value || "__all__",
    sexe: el("fSexe")?.value || "__all__",
    fonction: el("fFonction")?.value || "__all__",
    experience: el("fExperience")?.value || "__all__",
    formation: el("fFormation")?.value || "__all__",
    gtg: el("fGTG")?.value || "__all__",
    search: el("searchTable")?.value?.trim().toLowerCase() || ""
  };
}

function matchRow(row, f){
  const ministere = normalize(row[COL.ministere]);
  const sexe = normalize(row[COL.sexe]);
  const fonction = normalize(row[COL.fonction]);
  const experience = normalize(row[COL.experience]);
  const formation = normalize(row[COL.formation]);
  const gtg = normalize(row[COL.gtg]);

  if(f.ministere !== "__all__" && ministere !== f.ministere) return false;
  if(f.sexe !== "__all__" && sexe !== f.sexe) return false;
  if(f.fonction !== "__all__" && fonction !== f.fonction) return false;
  if(f.experience !== "__all__" && experience !== f.experience) return false;
  if(f.formation !== "__all__" && formation !== f.formation) return false;
  if(f.gtg !== "__all__" && gtg !== f.gtg) return false;

  if(f.search){
    const blob = JSON.stringify(row).toLowerCase();
    if(!blob.includes(f.search)) return false;
  }
  return true;
}

function renderChips(filters){
  const chips = el("activeChips");
  if(!chips) return;

  const items = [];
  if(filters.ministere !== "__all__") items.push(["Ministère", filters.ministere]);
  if(filters.sexe !== "__all__") items.push(["Sexe", filters.sexe]);
  if(filters.fonction !== "__all__") items.push(["Fonction", filters.fonction]);
  if(filters.experience !== "__all__") items.push(["Expérience", filters.experience]);
  if(filters.formation !== "__all__") items.push(["Formation", filters.formation]);
  if(filters.gtg !== "__all__") items.push(["GTG", filters.gtg]);
  if(filters.search) items.push(["Recherche", filters.search]);

  chips.innerHTML = items.length
    ? items.map(([k,v])=>`<span class="chip"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`).join("")
    : `<span class="chip"><strong>Filtres:</strong> Aucun (vue complète)</span>`;
}

// ---------- Counters ----------
function counterField(rows, colName){
  const c = {};
  for(const r of rows){
    const v = normalize(r[colName]);
    if(!v) continue;
    for(const part of splitMulti(v)){
      c[part] = (c[part] || 0) + 1;
    }
  }
  return c;
}

// Convert counter to % (Top N). For multi-select, we compute % within Top slice to keep 0–100 readable.
// If you prefer % of respondents, tell me and I adjust.
function toPercentTop(counterObj, top=10){
  const entries = Object.entries(counterObj || {})
    .filter(([k]) => !isSystemKey(k))
    .map(([k,v]) => [k, Number(v||0)])
    .filter(([,v]) => v > 0);

  entries.sort((a,b)=>b[1]-a[1]);
  const sliced = entries.slice(0, top);
  const total = sliced.reduce((a, x)=>a + x[1], 0) || 1;

  return {
    labels: sliced.map(x=>x[0]),
    values: sliced.map(x=>Math.round((x[1]/total)*100))
  };
}

function pctYes(rows, colName){
  const c = counterField(rows, colName);
  const total = Object.values(c).reduce((a,v)=>a+Number(v||0), 0);
  if(!total) return null;
  let yes = 0;
  for(const [k,v] of Object.entries(c)){
    const kk = String(k).toLowerCase();
    if(kk === "oui" || kk === "yes" || kk === "true") yes += Number(v||0);
  }
  return Math.round((yes/total)*100);
}

function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
  if(el("kpiN")) el("kpiN").textContent = n ?? "—";
}

// ===============================
// CHARTS — UN Blue + Orange + % labels
// ===============================
const UN = {
  blue:   "#1F4E79",
  orange: "#F58220",
  ink:    "#0f172a",
  grid:   "rgba(15,23,42,0.08)"
};

function applyModernChartDefaults(){
  if(!window.Chart) return;

  Chart.defaults.font.family = "Inter, Segoe UI, system-ui, -apple-system, Arial";
  Chart.defaults.color = "#334155";
  Chart.defaults.animation.duration = 450;

  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;

  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;

  // Plugin maison: % sur barres horizontales et doughnuts
  Chart.register({
    id: "valueLabels",
    afterDatasetsDraw(chart, args, pluginOptions){
      const opts = pluginOptions || {};
      if(opts.enabled === false) return;

      const { ctx } = chart;
      const type = chart.config.type;

      ctx.save();
      ctx.fillStyle = opts.color || UN.ink;
      ctx.font = `${opts.fontWeight || 700} ${opts.fontSize || 11}px Inter, Segoe UI, system-ui`;
      ctx.textBaseline = "middle";

      chart.data.datasets.forEach((dataset, di) => {
        const meta = chart.getDatasetMeta(di);
        if(meta.hidden) return;

        meta.data.forEach((element, i) => {
          const val = dataset.data[i];
          if(val === null || val === undefined) return;

          // barres horizontales
          if(type === "bar"){
            const x = element.x;
            const y = element.y;
            ctx.textAlign = "left";
            ctx.fillText(`${val}%`, x + 8, y);
          }

          // doughnut
          if(type === "doughnut"){
            const p = element.tooltipPosition();
            ctx.textAlign = "center";
            ctx.fillText(`${val}%`, p.x, p.y);
          }
        });
      });

      ctx.restore();
    }
  });
}

function destroyIfExists(canvas){
  if(canvas && canvas._chart){
    try{ canvas._chart.destroy(); } catch(e){}
    canvas._chart = null;
  }
}

function smartOptionsBarPct(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx)=> `${ctx.raw}%` } },
      valueLabels: { enabled: true, fontSize: 11, color: UN.ink }
    },
    scales: {
      x: {
        min: 0, max: 100,
        ticks: { callback: (v)=> `${v}%` },
        grid: { color: UN.grid },
        border: { display:false }
      },
      y: {
        grid: { display:false },
        border: { display:false }
      }
    },
    elements: { bar: { borderRadius: 10, borderSkipped: false } }
  };
}

function smartOptionsDonut(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "66%",
    plugins: {
      legend: { display: true, position: "bottom" },
      valueLabels: { enabled: true, fontSize: 11, color: UN.ink }
    }
  };
}

// Option couleur (pour différencier obstacles/actions si voulu)
function createSmartChart(canvasId, labels, values, title, forcedColor=null){
  const c = document.getElementById(canvasId);
  if(!c || !window.Chart) return null;
  destroyIfExists(c);

  const isBinary = labels.length <= 2;
  const type = isBinary ? "doughnut" : "bar";
  const options = isBinary ? smartOptionsDonut() : smartOptionsBarPct();

  const donutColors = [UN.blue, UN.orange, "#93C5FD", "#FDBA74"];

  const chart = new Chart(c, {
    type,
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        borderWidth: 0,
        backgroundColor: type === "bar"
          ? (forcedColor || UN.blue)
          : labels.map((_, i)=> donutColors[i % donutColors.length])
      }]
    },
    options
  });

  c._chart = chart;
  return chart;
}

// ===============================
// DASHBOARD LAYOUT + CHARTS
// ===============================
function buildDashboardLayout(){
  const host = el("dashboardSections");
  if(!host) return;

  host.innerHTML = `
    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Profil</h2></div>
        <span class="sectionChip">Smart</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Ministère</h3><canvas id="ch_ministere"></canvas></div>
        <div class="chartCard col-6"><h3>Sexe</h3><canvas id="ch_sexe"></canvas></div>
        <div class="chartCard col-6"><h3>Fonction</h3><canvas id="ch_fonction"></canvas></div>
        <div class="chartCard col-6"><h3>Expérience</h3><canvas id="ch_experience"></canvas></div>
        <div class="chartCard col-6"><h3>Formation genre</h3><canvas id="ch_formation"></canvas></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Connaissances</h2></div>
        <span class="sectionChip">Smart</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Compréhension du genre</h3><canvas id="ch_comprehension"></canvas></div>
        <div class="chartCard col-6"><h3>Différence sexe/genre</h3><canvas id="ch_diff"></canvas></div>
        <div class="chartCard col-6"><h3>« Genre = biologique »</h3><canvas id="ch_bio"></canvas></div>
        <div class="chartCard col-6"><h3>Connaît politique genre</h3><canvas id="ch_pol"></canvas></div>
        <div class="chartCard col-6"><h3>Genre important en politiques publiques</h3><canvas id="ch_pp"></canvas></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Pratiques institutionnelles</h2></div>
        <span class="sectionChip">Smart</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Cellule genre</h3><canvas id="ch_cellule"></canvas></div>
        <div class="chartCard col-6"><h3>Plan/stratégie genre</h3><canvas id="ch_plan"></canvas></div>
        <div class="chartCard col-6"><h3>Indicateurs sensibles au genre</h3><canvas id="ch_ind"></canvas></div>
        <div class="chartCard col-6"><h3>Outils/guide genre</h3><canvas id="ch_outils"></canvas></div>
        <div class="chartCard col-6"><h3>Fréquence formations genre</h3><canvas id="ch_freq"></canvas></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Perceptions & obstacles</h2></div>
        <span class="sectionChip">Evidence</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Genre important pour le secteur</h3><canvas id="ch_secteur"></canvas></div>
        <div class="chartCard col-6"><h3>Top obstacles</h3><canvas id="ch_obs"></canvas></div>
        <div class="chartCard col-6"><h3>Top actions prioritaires</h3><canvas id="ch_act"></canvas></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Coordination (GTG)</h2></div>
        <span class="sectionChip">GTG</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Connaissance GTG</h3><canvas id="ch_gtg"></canvas></div>
        <div class="chartCard col-6"><h3>Sous-groupes GTG connus</h3><canvas id="ch_sg"></canvas></div>
      </div>
    </div>
  `;
}

function renderDashboardCharts(rows){
  // KPI
  const pFormation = pctYes(rows, COL.formation);
  const pDiff = pctYes(rows, COL.diffSexeGenre);
  const pCellule = pctYes(rows, COL.celluleGenre);

  if(el("kpiFormation")) el("kpiFormation").textContent = (pFormation === null ? "—" : `${pFormation}%`);
  if(el("kpiDiff")) el("kpiDiff").textContent = (pDiff === null ? "—" : `${pDiff}%`);
  if(el("kpiCellule")) el("kpiCellule").textContent = (pCellule === null ? "—" : `${pCellule}%`);

  const mk = (id, col, top=10, color=null)=>{
    const d = toPercentTop(counterField(rows, col), top);
    createSmartChart(id, d.labels.length?d.labels:["—"], d.values.length?d.values:[0], col, color);
  };

  mk("ch_ministere", COL.ministere, 10, UN.blue);
  mk("ch_sexe", COL.sexe, 10, UN.blue);
  mk("ch_fonction", COL.fonction, 10, UN.blue);
  mk("ch_experience", COL.experience, 10, UN.blue);
  mk("ch_formation", COL.formation, 10, UN.blue);

  mk("ch_comprehension", COL.comprehension, 10, UN.blue);
  mk("ch_diff", COL.diffSexeGenre, 10, UN.blue);
  mk("ch_bio", COL.genreBio, 10, UN.blue);
  mk("ch_pol", COL.connaitPolitique, 10, UN.blue);
  mk("ch_pp", COL.genreImportantPP, 10, UN.blue);

  mk("ch_cellule", COL.celluleGenre, 10, UN.blue);
  mk("ch_plan", COL.planGenre, 10, UN.blue);
  mk("ch_ind", COL.indicateurs, 10, UN.blue);
  mk("ch_outils", COL.outils, 10, UN.blue);
  mk("ch_freq", COL.freqFormations, 10, UN.blue);

  mk("ch_secteur", COL.genreImportantSecteur, 10, UN.blue);

  // Differencier visuellement obstacles vs actions
  mk("ch_obs", COL.obstacles, 10, UN.blue);
  mk("ch_act", COL.actions, 10, UN.orange);

  mk("ch_gtg", COL.gtg, 10, UN.blue);
  mk("ch_sg", COL.sousGroupes, 10, UN.blue);
}

// ---------- Table page ----------
function buildTable(filteredRows, allRows){
  const thead = el("thead");
  const tbody = el("tbody");
  const nShown = el("nShown");
  if(!thead || !tbody) return;

  const cols = allRows.length ? Object.keys(allRows[0]).filter(c => !isSystemKey(c)) : [];
  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(headerLabel(c))}</th>`).join("")}</tr>`;

  if(nShown) nShown.textContent = filteredRows.length;

  tbody.innerHTML = filteredRows.map(r => {
    return `<tr>${cols.map(c => {
      const s = normalize(r[c]);
      return s ? `<td>${escapeHtml(s)}</td>` : `<td class="muted">—</td>`;
    }).join("")}</tr>`;
  }).join("");
}

// ---------- Recommendations list helper ----------
function fillGlobalRecos(recosMaybe){
  const ul = el("globalRecos");
  if(!ul) return;
  const list = (recosMaybe?.recommendations || []);
  ul.innerHTML = list.length
    ? list.map(x=>`<li>${escapeHtml(x)}</li>`).join("")
    : `<li>Recommandations globales non disponibles (fichier recommendations_global.json absent/vide).</li>`;
}

// ---------- Main ----------
async function main(){
  applyModernChartDefaults();

  const page = document.body.getAttribute("data-page");

  const tPayload = await loadJson(TABLE);
  const allRows = unwrapArray(tPayload);
  if(!allRows || !allRows.length) throw new Error("submissions_table.json vide/invalide");

  const statsMaybe = await loadJson(STATS).catch(()=>null);
  const recosMaybe = await loadJson(RECOS).catch(()=>null);

  const generatedAt = statsMaybe?.generated_at || statsMaybe?.meta?.generated_at || null;

  // options filtres
  buildSelect(el("fMinistere"), uniq(allRows.map(r=>normalize(r[COL.ministere]))));
  buildSelect(el("fSexe"), uniq(allRows.map(r=>normalize(r[COL.sexe]))));
  buildSelect(el("fFonction"), uniq(allRows.map(r=>normalize(r[COL.fonction]))));
  buildSelect(el("fExperience"), uniq(allRows.map(r=>normalize(r[COL.experience]))));
  buildSelect(el("fFormation"), uniq(allRows.map(r=>normalize(r[COL.formation]))));
  buildSelect(el("fGTG"), uniq(allRows.map(r=>normalize(r[COL.gtg]))));

  // reset
  el("btnResetFilters")?.addEventListener("click", ()=>{
    ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG"].forEach(id=>{
      if(el(id)) el(id).value = "__all__";
    });
    if(el("searchTable")) el("searchTable").value = "";
    refresh();
  });

  // dashboard sections injection
  if(page === "dashboard"){
    buildDashboardLayout();
  }

  // events
  ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG","searchTable"].forEach(id=>{
    const x = el(id);
    if(!x) return;
    x.addEventListener(id === "searchTable" ? "input" : "change", refresh);
  });

  function refresh(){
    const f = getCurrentFilters();
    renderChips(f);

    const filtered = allRows.filter(r=>matchRow(r,f));
    setMeta(generatedAt, filtered.length);

    if(page === "responses"){
      buildTable(filtered, allRows);
      return;
    }

    if(page === "dashboard"){
      renderDashboardCharts(filtered);
      return;
    }

    if(page === "analysis" || page === "recommendations"){
      // KPI signaux (si présents sur la page)
      const sigCell = pctYes(filtered, COL.celluleGenre);
      const sigPlan = pctYes(filtered, COL.planGenre);
      const sigInd  = pctYes(filtered, COL.indicateurs);
      const sigOut  = pctYes(filtered, COL.outils);

      if(el("sigCellule")) el("sigCellule").textContent = (sigCell === null ? "—" : `${sigCell}%`);
      if(el("sigPlan"))    el("sigPlan").textContent    = (sigPlan === null ? "—" : `${sigPlan}%`);
      if(el("sigInd"))     el("sigInd").textContent     = (sigInd === null ? "—" : `${sigInd}%`);
      if(el("sigOutils"))  el("sigOutils").textContent  = (sigOut === null ? "—" : `${sigOut}%`);

      // Charts
      const dObs = toPercentTop(counterField(filtered, COL.obstacles), 10);
      createSmartChart("chartTopObstacles",
        dObs.labels.length?dObs.labels:["—"],
        dObs.values.length?dObs.values:[0],
        "Top obstacles",
        UN.blue
      );

      const dAct = toPercentTop(counterField(filtered, COL.actions), 10);
      createSmartChart("chartTopActions",
        dAct.labels.length?dAct.labels:["—"],
        dAct.values.length?dAct.values:[0],
        "Top actions",
        UN.orange
      );

      fillGlobalRecos(recosMaybe);
      return;
    }
  }

  // initial
  refresh();
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
