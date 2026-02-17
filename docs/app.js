const DATA_FLAT = "data/submissions_flat.json";
const STATS = "data/stats.json";
const RAW = "data/submissions.json";
const ANALYSIS = "data/analysis_recos.json";

function el(id){ return document.getElementById(id); }

function formatDateISO(s){
  if(!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR");
}

async function loadJson(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`Fetch failed: ${path} ${r.status}`);
  return r.json();
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toChartData(counterObj){
  const entries = Object.entries(counterObj || {}).filter(([k]) => k !== "_missing");
  entries.sort((a,b) => b[1]-a[1]);
  return {
    labels: entries.map(e => e[0]),
    values: entries.map(e => e[1]),
  };
}

function toTopChartData(counterObj, topN=10){
  const d = toChartData(counterObj);
  return { labels: d.labels.slice(0, topN), values: d.values.slice(0, topN) };
}

function createChart(canvasId, labels, values, title){
  const c = document.getElementById(canvasId);
  if(!c) return null;
  return new Chart(c, {
    type: "bar",
    data: { labels, datasets: [{ label: title, data: values }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function setGlobalMeta(flat, stats){
  const n = stats?.n ?? flat?.length ?? null;
  const nEl = el("nResponses");
  if(nEl && n !== null) nEl.textContent = n;

  // last update = max submission time
  const times = (flat || [])
    .map(r => r["_submission_time"])
    .filter(Boolean)
    .map(t => new Date(t).getTime())
    .filter(t => !isNaN(t));

  const maxT = times.length ? new Date(Math.max(...times)).toISOString() : null;
  const last = el("lastUpdate");
  if(last) last.textContent = maxT ? formatDateISO(maxT) : "—";
}

function percentFromCounter(counterObj, keyWanted){
  const c = counterObj || {};
  const total = Object.entries(c).reduce((acc,[k,v]) => (k === "_missing" ? acc : acc + v), 0);
  if(!total) return null;
  const val = c[keyWanted] || 0;
  return Math.round((val / total) * 100);
}

/* -------------------------
   PAGE: DASHBOARD
-------------------------- */
function renderDashboard(flat, stats){
  // KPI
  const n = stats?.n ?? flat.length;
  const consentPct = percentFromCounter(stats?.counters?.["consent"], "oui");
  const cellulePct = percentFromCounter(stats?.counters?.["sec3/cellule_genre"], "oui");
  const formationPct = percentFromCounter(stats?.counters?.["sec1/formation_genre"], "oui");

  if(el("kpiN")) el("kpiN").textContent = n ?? "—";
  if(el("kpiConsent")) el("kpiConsent").textContent = (consentPct === null ? "—" : `${consentPct}%`);
  if(el("kpiCellule")) el("kpiCellule").textContent = (cellulePct === null ? "—" : `${cellulePct}%`);
  if(el("kpiFormation")) el("kpiFormation").textContent = (formationPct === null ? "—" : `${formationPct}%`);

  // Charts from stats.json
  const c = stats.counters || {};
  const m = stats.multi || {};

  const sexe = toChartData(c["sec1/sexe"]);
  createChart("chartSexe", sexe.labels, sexe.values, "Sexe");

  const ministere = toChartData(c["sec1/ministere"]);
  createChart("chartMinistere", ministere.labels, ministere.values, "Ministère");

  const compr = toChartData(c["sec2/compr_genre"]);
  createChart("chartCompr", compr.labels, compr.values, "Compréhension");

  const pol = toChartData(c["sec2/politiques_genre_connaissance"]);
  createChart("chartPolConnues", pol.labels, pol.values, "Politiques connues");

  const obstacles = toTopChartData(m["sec4/obstacles"], 10);
  createChart("chartObstacles", obstacles.labels, obstacles.values, "Obstacles");

  const actions = toTopChartData(m["sec4/actions"], 10);
  createChart("chartActions", actions.labels, actions.values, "Actions");
}

/* -------------------------
   PAGE: RESPONSES
-------------------------- */
function renderResponsesTable(flat){
  const thead = el("theadResponses");
  const tbody = el("tbodyResponses");
  if(!thead || !tbody) return;

  const cols = [
    "_submission_time",
    "sec1/ministere",
    "sec1/sexe",
    "sec1/fonction",
    "sec1/annees_experience_ministere",
    "sec1/formation_genre",
    "sec2/compr_genre",
    "sec2/politiques_genre_connaissance",
    "sec2/politiques_genre_liste",
    "sec3/cellule_genre",
    "sec3/plan_action_genre",
    "sec3/indicateurs_genre",
    "sec3/outils_guide_genre",
    "sec3/budget_genre_annuel",
    "sec4/obstacles",
    "sec4/actions",
    "sec5/gtg_connaissance",
    "sec5/sgtgtg_connus",
    "sec6/recommandations"
  ];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;

  const render = (rows) => {
    tbody.innerHTML = rows.map(r => {
      return `<tr>${cols.map(c => {
        let v = r[c];
        if(c === "_submission_time") v = formatDateISO(v);
        if(v === undefined || v === null || v === "") v = "—";
        return `<td>${escapeHtml(v)}</td>`;
      }).join("")}</tr>`;
    }).join("");
  };

  render(flat);

  const input = el("searchResponses");
  if(input){
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if(!q) return render(flat);
      const filtered = flat.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      render(filtered);
    });
  }
}

/* -------------------------
   PAGE: ANALYSIS
-------------------------- */
function buildAnalysisTable(payload){
  const rows = payload?.results || [];
  const thead = el("theadAnalysis");
  const tbody = el("tbodyAnalysis");
  if(!thead || !tbody) return;

  const cols = [
    "_submission_time",
    "ministere",
    "sexe",
    "fonction",
    "score_maturite_0_7",
    "niveau_maturite",
    "priorite_actions",
    "gaps_cles",
    "forces",
    "recommandations",
    "reco_verbatim"
  ];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;

  function cellValue(r, c){
    let v = r[c];
    if(c === "_submission_time") v = formatDateISO(v);
    if(Array.isArray(v)) v = v.join(" • ");
    if(v === undefined || v === null || v === "") v = "—";
    return escapeHtml(v);
  }

  const render = (data) => {
    tbody.innerHTML = data.map(r => {
      return `<tr>${cols.map(c => `<td>${cellValue(r, c)}</td>`).join("")}</tr>`;
    }).join("");
  };

  render(rows);

  const input = el("searchAnalysis");
  if(input){
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if(!q) return render(rows);
      const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      render(filtered);
    });
  }
}

function renderGlobalRecos(payload){
  const rows = payload?.results || [];
  const topGapsEl = el("topGaps");
  const globalRecosEl = el("globalRecos");
  if(!topGapsEl || !globalRecosEl) return;

  // Count gaps (labels already)
  const gapCounts = new Map();
  for(const r of rows){
    const gaps = r.gaps_cles || [];
    for(const g of gaps){
      gapCounts.set(g, (gapCounts.get(g) || 0) + 1);
    }
  }

  const sorted = Array.from(gapCounts.entries()).sort((a,b) => b[1]-a[1]);
  const top = sorted.slice(0, 5);

  // Render top gaps as pills
  topGapsEl.innerHTML = top.length
    ? top.map(([g, n]) => `<span class="pill warn">${escapeHtml(g)} • ${n}</span>`).join("")
    : `<span class="small">Aucun gap détecté.</span>`;

  // Global prioritized plan (simple mapping by keywords)
  const plan = [];
  const names = top.map(x => x[0]).join(" ").toLowerCase();

  // Generic prioritized steps:
  if(names.includes("cellule")) plan.push("Institutionnaliser une cellule genre + ToR points focaux + reporting mensuel.");
  if(names.includes("plan d’action")) plan.push("Élaborer un plan d’action genre 12 mois (activités, coûts, responsables, échéances).");
  if(names.includes("indicateurs")) plan.push("Définir un set minimal d’indicateurs genre + routine de suivi (mensuel/trimestriel).");
  if(names.includes("outils") || names.includes("guide")) plan.push("Produire un mini-guide et des outils standard (checklist, fiche projet, grille analyse).");
  if(names.includes("formation")) plan.push("Mettre en place un module de renforcement ciblé (concepts, politiques, cas pratiques).");
  if(names.includes("coordination") || names.includes("gtg")) plan.push("Organiser un onboarding GTG + participation aux sous-groupes pertinents.");

  // Fallback if none
  if(plan.length === 0){
    plan.push("Consolider les dispositifs existants, améliorer la documentation, et systématiser le suivi via indicateurs.");
  }

  globalRecosEl.innerHTML = plan.map(x => `<li>${escapeHtml(x)}</li>`).join("");
}

function renderAnalysisCharts(payload){
  const summary = payload?.summary || {};
  const scoreDist = toChartData(summary.score_distribution || {});
  const prioDist = toChartData(summary.priority_distribution || {});
  createChart("chartScoreDist", scoreDist.labels, scoreDist.values, "Score (0–7)");
  createChart("chartPriorityDist", prioDist.labels, prioDist.values, "Priorité");
}

/* -------------------------
   MAIN
-------------------------- */
async function main(){
  const page = document.body.getAttribute("data-page") || "dashboard";

  const [flat, stats] = await Promise.all([
    loadJson(DATA_FLAT),
    loadJson(STATS)
  ]);

  setGlobalMeta(flat, stats);

  if(page === "dashboard"){
    renderDashboard(flat, stats);
    return;
  }

  if(page === "responses"){
    renderResponsesTable(flat);
    return;
  }

  if(page === "analysis"){
    const analysis = await loadJson(ANALYSIS);
    buildAnalysisTable(analysis);
    renderAnalysisCharts(analysis);
    renderGlobalRecos(analysis);
    return;
  }
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
