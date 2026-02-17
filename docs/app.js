const DATA_FLAT = "data/submissions_flat.json";
const STATS = "data/stats.json";
const RAW = "data/submissions.json";

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

function buildTable(rows){
  const thead = el("thead");
  const tbody = el("tbody");

  // Pick a compact set of columns (you can add/remove)
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
    "sec4/obstacles",
    "sec4/actions",
    "sec5/gtg_connaissance",
    "sec6/recommandations"
  ];

  // Header
  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;

  // Rows
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

  // Search
  const input = el("search");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q) return render(rows);
    const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    render(filtered);
  });
}

function escapeHtml(str){
  return str
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
  const [flat, stats, raw] = await Promise.all([
    loadJson(DATA_FLAT),
    loadJson(STATS),
    loadJson(RAW)
  ]);

  el("nResponses").textContent = stats.n ?? flat.length ?? "—";

  // last update: use max submission_time from flat
  const times = flat.map(r => r["_submission_time"]).filter(Boolean).map(t => new Date(t).getTime()).filter(t => !isNaN(t));
  const maxT = times.length ? new Date(Math.max(...times)).toISOString() : null;
  el("lastUpdate").textContent = maxT ? formatDateISO(maxT) : "—";

  buildTable(flat);

  // Charts from stats
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
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
