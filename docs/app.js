// ===============================
// Enquête Genre RDC — APP (Robuste)
// Aligné sur colonnes "humaines" (Ministere, Sexe, etc.)
// ===============================

const TABLE = "data/submissions_table.json";                 // votre JSON (array d'objets)
const RECOS = "data/recommendations_global.json";            // optionnel
const STATS = "data/stats.json";                             // optionnel
const QUESTIONS = "data/questions.json";                     // optionnel (non requis)

// ---------- Helpers DOM ----------
function el(id){ return document.getElementById(id); }

// ---------- UI Error Banner ----------
function showFatal(message, details=""){
  console.error("FATAL:", message, details);
  const barId = "fatalBar";
  let bar = document.getElementById(barId);
  if(!bar){
    bar = document.createElement("div");
    bar.id = barId;
    bar.style.cssText = `
      position: sticky; top: 0; z-index: 9999;
      background: #b91c1c; color: #fff;
      padding: 10px 14px;
      font-family: system-ui, -apple-system, Segoe UI, Arial;
      font-size: 13px;
      box-shadow: 0 10px 20px rgba(0,0,0,.18);
    `;
    document.body.prepend(bar);
  }
  bar.innerHTML = `
    <strong>Erreur chargement dashboard</strong> — ${escapeHtml(message)}
    ${details ? `<div style="opacity:.9; margin-top:6px">${escapeHtml(details)}</div>` : ""}
    <div style="opacity:.9; margin-top:6px">Ouvrez la console (F12) pour voir l’erreur exacte.</div>
  `;
}

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
  // Inclure le bullet "•"
  if(/[•;,|\n]/.test(s)){
    return s
      .split(/[•;,|\n]+/)
      .map(x=>x.trim())
      .filter(Boolean);
  }
  return [s];
}

// ---------- Colonnes réelles (d'après votre sample) ----------
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

// ---------- System keys (dans votre cas, quasi aucun) ----------
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

// ---------- Chart.js modern defaults ----------
function applyModernChartDefaults(){
  if(!window.Chart) return;
  Chart.defaults.font.family = "Inter, Segoe UI, system-ui, -apple-system, Arial";
  Chart.defaults.color = "#334155";
  Chart.defaults.animation.duration = 450;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
}

function destroyIfExists(canvas){
  if(canvas && canvas._chart){
    try{ canvas._chart.destroy(); } catch(e){}
    canvas._chart = null;
  }
}

function makeGradient(ctx, area){
  const g = ctx.createLinearGradient(area.left, area.top, area.right, area.bottom);
  g.addColorStop(0, "rgba(47,128,237,0.88)");
  g.addColorStop(1, "rgba(106,90,224,0.88)");
  return g;
}

function smartOptionsBarPct(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx)=> `${ctx.raw}%` } }
    },
    scales: {
      x: { min:0, max:100, ticks:{ callback:(v)=>`${v}%` }, grid:{ color:"rgba(15,23,42,0.06)" }, border:{ display:false } },
      y: { grid:{ display:false }, border:{ display:false } }
    },
    elements: { bar: { borderRadius: 10, borderSkipped: false } }
  };
}

function smartOptionsDonut(){
  return {
    responsive:true,
    maintainAspectRatio:false,
    cutout:"66%",
    plugins:{ legend:{ display:true, position:"bottom" } }
  };
}

function createSmartChart(canvasId, labels, values, title){
  const c = document.getElementById(canvasId);
  if(!c || !window.Chart) return null;
  destroyIfExists(c);

  const isBinary = labels.length <= 2;
  const type = isBinary ? "doughnut" : "bar";
  const options = isBinary ? smartOptionsDonut() : smartOptionsBarPct();

  const chart = new Chart(c, {
    type,
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        borderWidth: 0,
        backgroundColor: (ctx)=>{
          if(type !== "bar") return undefined;
          const {chart} = ctx;
          const {ctx: cctx, chartArea} = chart;
          if(!chartArea) return "rgba(47,128,237,0.85)";
          return makeGradient(cctx, chartArea);
        }
      }]
    },
    options
  });

  c._chart = chart;
  return chart;
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
  if(yes === 0) return 0;
  return Math.round((yes/total)*100);
}

function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
  if(el("kpiN")) el("kpiN").textContent = n ?? "—";
}

// ---------- Dashboard definitions (sans questions.json) ----------
function buildDashboardLayout(){
  const host = el("dashboardSections");
  if(!host) return;

  // On construit une grille stable avec IDs connus
  host.innerHTML = `
    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Profil</h2><p class="subhead">Lecture compacte et comparable.</p></div>
        <span class="sectionChip">Smart charts</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Ministère</h3><canvas id="ch_ministere"></canvas><div class="small">Smart • % • Top 10</div></div>
        <div class="chartCard col-6"><h3>Sexe</h3><canvas id="ch_sexe"></canvas><div class="small">Smart • % • Top 10</div></div>
        <div class="chartCard col-6"><h3>Fonction</h3><canvas id="ch_fonction"></canvas><div class="small">Smart • % • Top 10</div></div>
        <div class="chartCard col-6"><h3>Expérience</h3><canvas id="ch_experience"></canvas><div class="small">Smart • % • Top 10</div></div>
        <div class="chartCard col-6"><h3>Formation genre</h3><canvas id="ch_formation"></canvas><div class="small">Smart • %</div></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Connaissances</h2><p class="subhead">Compréhension et notions clés.</p></div>
        <span class="sectionChip">Smart charts</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Compréhension du genre</h3><canvas id="ch_comprehension"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Différence sexe/genre</h3><canvas id="ch_diff"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>« Genre = biologique »</h3><canvas id="ch_bio"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Connaît politique genre</h3><canvas id="ch_pol"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Genre important en politiques publiques</h3><canvas id="ch_pp"></canvas><div class="small">Smart • %</div></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Pratiques institutionnelles</h2><p class="subhead">Dispositifs, planification, outils.</p></div>
        <span class="sectionChip">Smart charts</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Cellule genre</h3><canvas id="ch_cellule"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Plan/stratégie genre</h3><canvas id="ch_plan"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Indicateurs sensibles au genre</h3><canvas id="ch_ind"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Outils/guide genre</h3><canvas id="ch_outils"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Fréquence formations genre</h3><canvas id="ch_freq"></canvas><div class="small">Smart • %</div></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Perceptions & obstacles</h2><p class="subhead">Freins et actions prioritaires.</p></div>
        <span class="sectionChip">Evidence</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Genre important pour le secteur</h3><canvas id="ch_secteur"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Top obstacles</h3><canvas id="ch_obs"></canvas><div class="small">Barres horizontales (%)</div></div>
        <div class="chartCard col-6"><h3>Top actions prioritaires</h3><canvas id="ch_act"></canvas><div class="small">Barres horizontales (%)</div></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sectionTitle">
        <div><h2 style="margin:0">Coordination (GTG)</h2><p class="subhead">Connaissance et sous-groupes.</p></div>
        <span class="sectionChip">GTG</span>
      </div>
      <div class="grid">
        <div class="chartCard col-6"><h3>Connaissance GTG</h3><canvas id="ch_gtg"></canvas><div class="small">Smart • %</div></div>
        <div class="chartCard col-6"><h3>Sous-groupes GTG connus</h3><canvas id="ch_sg"></canvas><div class="small">Barres horizontales (%)</div></div>
      </div>
    </div>
  `;
}

function renderDashboardCharts(rows){
  // KPI (si vos IDs existent dans le HTML)
  if(el("kpiFormation")) el("kpiFormation").textContent = (pctYes(rows, COL.formation) ?? "—") + (pctYes(rows, COL.formation)===null?"":"%");
  if(el("kpiDiff")) el("kpiDiff").textContent = (pctYes(rows, COL.diffSexeGenre) ?? "—") + (pctYes(rows, COL.diffSexeGenre)===null?"":"%");
  if(el("kpiCellule")) el("kpiCellule").textContent = (pctYes(rows, COL.celluleGenre) ?? "—") + (pctYes(rows, COL.celluleGenre)===null?"":"%");

  // charts (smart)
  const mk = (id, col, top=10)=>{
    const d = toPercentTop(counterField(rows, col), top);
    createSmartChart(id, d.labels.length?d.labels:["—"], d.values.length?d.values:[0], col);
  };

  mk("ch_ministere", COL.ministere, 10);
  mk("ch_sexe", COL.sexe, 10);
  mk("ch_fonction", COL.fonction, 10);
  mk("ch_experience", COL.experience, 10);
  mk("ch_formation", COL.formation, 10);

  mk("ch_comprehension", COL.comprehension, 10);
  mk("ch_diff", COL.diffSexeGenre, 10);
  mk("ch_bio", COL.genreBio, 10);
  mk("ch_pol", COL.connaitPolitique, 10);
  mk("ch_pp", COL.genreImportantPP, 10);

  mk("ch_cellule", COL.celluleGenre, 10);
  mk("ch_plan", COL.planGenre, 10);
  mk("ch_ind", COL.indicateurs, 10);
  mk("ch_outils", COL.outils, 10);
  mk("ch_freq", COL.freqFormations, 10);

  mk("ch_secteur", COL.genreImportantSecteur, 10);

  // Multi-sélection (obstacles/actions/sous-groupes) : déjà géré via splitMulti()
  mk("ch_obs", COL.obstacles, 10);
  mk("ch_act", COL.actions, 10);

  mk("ch_gtg", COL.gtg, 10);
  mk("ch_sg", COL.sousGroupes, 10);
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

// ---------- Main ----------
async function main(){
  try{
    applyModernChartDefaults();
    const page = document.body.getAttribute("data-page");
    console.log("APP page=", page);

    const tPayload = await loadJson(TABLE);
    const allRows = unwrapArray(tPayload);
    if(!allRows) throw new Error("submissions_table.json doit être un array ou {data:[…]} / {results:[…]}");
    if(!allRows.length) throw new Error("submissions_table.json est vide");

    const statsMaybe = await loadJson(STATS).catch(()=>null);
    const recosMaybe = await loadJson(RECOS).catch(()=>null);
    await loadJson(QUESTIONS).catch(()=>null); // non utilisé ici, juste toléré

    const generatedAt = statsMaybe?.generated_at || statsMaybe?.meta?.generated_at || null;

    // construire options filtres
    const ministeres = uniq(allRows.map(r=>normalize(r[COL.ministere])));
    const sexes = uniq(allRows.map(r=>normalize(r[COL.sexe])));
    const fonctions = uniq(allRows.map(r=>normalize(r[COL.fonction])));
    const experiences = uniq(allRows.map(r=>normalize(r[COL.experience])));
    const formations = uniq(allRows.map(r=>normalize(r[COL.formation])));
    const gtgVals = uniq(allRows.map(r=>normalize(r[COL.gtg])));

    buildSelect(el("fMinistere"), ministeres);
    buildSelect(el("fSexe"), sexes);
    buildSelect(el("fFonction"), fonctions);
    buildSelect(el("fExperience"), experiences);
    buildSelect(el("fFormation"), formations);
    buildSelect(el("fGTG"), gtgVals);

    // bouton reset si existe
    el("btnResetFilters")?.addEventListener("click", ()=>{
      ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG"].forEach(id=>{
        if(el(id)) el(id).value = "__all__";
      });
      if(el("searchTable")) el("searchTable").value = "";
      refresh();
    });

    // Dashboard layout
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
        // si vous avez des canvas sur ces pages, on peut réutiliser mêmes charts
        // (laisser simple: obstacles/actions + liste recos)
        const dObs = toPercentTop(counterField(filtered, COL.obstacles), 10);
        createSmartChart("chartTopObstacles", dObs.labels.length?dObs.labels:["—"], dObs.values.length?dObs.values:[0], "Top obstacles");

        const dAct = toPercentTop(counterField(filtered, COL.actions), 10);
        createSmartChart("chartTopActions", dAct.labels.length?dAct.labels:["—"], dAct.values.length?dAct.values:[0], "Top actions");

        const ul = el("globalRecos");
        if(ul){
          const list = (recosMaybe?.recommendations || []);
          ul.innerHTML = list.length
            ? list.map(x=>`<li>${escapeHtml(x)}</li>`).join("")
            : `<li>Recommandations globales non disponibles (fichier recommendations_global.json absent/vide).</li>`;
        }
        return;
      }
    }

    refresh();

  } catch(e){
    showFatal("Impossible d'initialiser", e.message);
  }
}

main();
