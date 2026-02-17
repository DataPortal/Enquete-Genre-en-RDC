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
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTable(rows){
  const thead = el("thead");
  const tbody = el("tbody");

  const cols = [
    "_submission_time",
    "sec1/ministere",
    "sec1/sexe",
    "sec1/fonction",
    "sec1/annees_experience_ministere",
    "sec1/formation_genre",
    "sec2/compr_genre",
    "sec2/politiques_genre_connaissance",
    "sec3/cellule_genre",
    "sec3/plan_action_genre",
    "sec3/indicateurs_genre",
    "sec3/outils_guide_genre",
    "sec4/obstacles",
    "sec4/actions",
    "sec5/gtg_connaissance",
    "sec6/recommandations"
  ];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;

  const render = (filtered) => {
    tbody.innerHTML = filtered.map(r => {
      return `<tr>${cols.map(c => {
        let v = r[c];
        if(c === "_submission_time") v = formatDateISO(v);
        if(v === undefined || v === null || v === "") v = "—";
        return `<td>${escapeHtml(String(v))}</td>`;
      }).join("")}</tr>`;
    }).join("");
  };

  render(rows);

  const input = el("search");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q) return render(rows);
    const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    render(filtered);
  });
}

function buildAnalysisTable(payload){
  const rows = payload.results || [];
  const thead = el("theadAnalysis");
  const tbody = el("tbodyAnalysis");

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

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;

  function cellValue(r, c){
    let v = r[c];
    if(c === "_submission_time") v = formatDateISO(v);
    if(Array.isArray(v)) v = v.join(" • ");
    if(v === undefined || v === null || v === "") v = "—";
    return escapeHtml(String(v));
  }

  const render = (filtered) => {
    tbody.innerHTML = filtered.map(r => {
      return `<tr>${cols.map(c => `<td>${cellValue(r, c)}</td>`).join("")}</tr>`;
    }).join("");
  };

  render(rows);

  const input = el("searchAnalysis");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q) return render(rows);
    const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    render(filtered);
  });
}

function toChartData(counterObj){
  const entries = Object.entries(counterObj || {}).filter(([k]) => k !== "_missing");
  entries.sort((a,b) => b[1]-a[1]);
  return {
    labels: entries.map(e => e[0]),
    values: entries.map(e => e[1]),
  };
}

function toTopChartData(counterObj, topN=8){
  const d = toChartData(counterObj);
  return {
    labels: d.labels.slice(0, topN),
    values: d.values.slice(0, topN),
  };
}

function createChart(canvasId, labels, values, title){
  const ctx = document.getElementById(canvasId);
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: title, data: values }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

async function main(){
  const [flat, stats, raw, analysis] = await Promise.all([
    loadJson(DATA_FLAT),
    loadJson(STATS),
    loadJson(RAW),
    loadJson(ANALYSIS).catch(() => null) // analysis may not exist on first run
  ]);

  el("nResponses").textContent = (stats.n ?? flat.length ?? "—");

  // last update: max submission_time
  const times = flat.map(r => r["_submission_time"]).filter(Boolean).map(t => new Date(t).getTime()).filter(t => !isNaN(t));
  const maxT = times.length ? new Date(Math.max(...times)).toISOString() : null;
  el("lastUpdate").textContent = maxT ? formatDateISO(maxT) : "—";

  buildTable(flat);

  // Charts from stats.json
  const c = stats.counters || {};
  const m = stats.multi || {};

  const sexe = toChartData(c["sec1/sexe"]);
  createChart("chartSexe", sexe.labels, sexe.values, "Sexe");

  const formation = toChartData(c["sec1/formation_genre"]);
  createChart("chartFormation", formation.labels, formation.values, "Formation genre");

  const cellule = toChartData(c["sec3/cellule_genre"]);
  createChart("chartCellule", cellule.labels, cellule.values, "Cellule genre");

  const obstacles = toTopChartData(m["sec4/obstacles"], 8);
  createChart("chartObstacles", obstacles.labels, obstacles.values, "Obstacles (Top)");

  // Analysis section (table + charts)
  if(analysis && analysis.summary){
    buildAnalysisTable(analysis);

    const scoreDist = analysis.summary.score_distribution || {};
    const priorityDist = analysis.summary.priority_distribution || {};

    const scoreData = toChartData(scoreDist);
    createChart("chartScoreDist", scoreData.labels, scoreData.values, "Score (0–7)");

    const prioData = toChartData(priorityDist);
    createChart("chartPriorityDist", prioData.labels, prioData.values, "Priorité");
  } else {
    // If analysis not generated yet, show minimal message in analysis table
    const tbody = el("tbodyAnalysis");
    const thead = el("theadAnalysis");
    if (thead) thead.innerHTML = "<tr><th>Info</th></tr>";
    if (tbody) tbody.innerHTML = "<tr><td>analysis_recos.json introuvable. Exécute scripts/analyze_recos.py (et ajoute-le au workflow).</td></tr>";
  }
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
