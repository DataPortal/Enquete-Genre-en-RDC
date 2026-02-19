const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";
const STATS = "data/stats.json"; // optional, for generated_at

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

function formatDateISO(s){
  if(!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR");
}

function formatPct(p){
  if(p === null || p === undefined) return "—";
  return `${p}%`;
}

function normalize(v){
  if(v === null || v === undefined) return "";
  return String(v).trim();
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

/* ---------- Exclure les champs systèmes ---------- */
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
  return String(c).replaceAll("_"," ").replaceAll("/"," • ");
}

/* ---------- Multi-sélection (obstacles/actions/GTG subgroups) ---------- */
function splitMulti(val){
  const s = normalize(val);
  if(!s) return [];
  // support ; , | and new lines
  if(/[;,|\n]/.test(s)){
    return s.split(/[;,|\n]+/).map(x=>x.trim()).filter(Boolean);
  }
  return [s];
}

/* ---------- Mapping champs (robuste) ---------- */
const FIELDS = {
  consent: ["consent","intro/consent","consentement"],
  ministere: ["ministere","intro/ministere","sec1/ministere","ministere_sg","ministere_ou_sg"],
  sexe: ["sexe","intro/sexe"],
  fonction: ["fonction","intro/fonction","fonction_actuelle"],
  experience: ["annees_experience_ministere","intro/annees_experience_ministere","experience","annees_experience"],
  formation: ["formation_genre","sec1/formation_genre","intro/formation_genre"],

  // knowledge
  diffSexeGenre: ["diff_sexe_genre","sec2/diff_sexe_genre"],
  genreBioStatement: ["genre_biologique","sec2/genre_biologique"],
  politiquesConnues: ["politiques_genre_connaissance","sec2/politiques_genre_connaissance"],
  importancePolPub: ["importance_genre","sec2/importance_genre"],

  // institutional
  celluleGenre: ["cellule_genre","sec3/cellule_genre"],
  planGenre: ["plan_strategie_genre","plan_strategie","sec3/plan_strategie"],
  indicateurs: ["indicateurs_genre","sec3/indicateurs_genre"],
  outilsGuides: ["outils_guides_genre","outils_genre","sec3/outils_guides_genre"],

  // obstacles/actions
  obstacles: ["obstacles_genre","principaux_obstacles","sec4/obstacles"],
  actions: ["actions_prioritaires","sec4/actions_prioritaires"],

  // gtg
  gtgHeard: ["gtg_connu","entendu_gtg","sec5/gtg_entendu"],
  gtgSubgroups: ["gtg_sous_groupes","sec5/gtg_sousgroupes"]
};

function pickField(row, candidates){
  for(const k of candidates){
    if(row && Object.prototype.hasOwnProperty.call(row, k)){
      const v = normalize(row[k]);
      if(v) return v;
    }
  }
  return "";
}

/* ---------- Consent filter (important) ---------- */
function isConsented(row){
  const v = pickField(row, FIELDS.consent).toLowerCase();
  if(!v) return true; // fallback if no field
  return (v === "oui" || v === "yes" || v === "true");
}

/* ---------- Filters state ---------- */
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
  if(!isConsented(row)) return false;

  const ministere = pickField(row, FIELDS.ministere);
  const sexe = pickField(row, FIELDS.sexe);
  const fonction = pickField(row, FIELDS.fonction);
  const experience = pickField(row, FIELDS.experience);
  const formation = pickField(row, FIELDS.formation);
  const gtg = pickField(row, FIELDS.gtgHeard);

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

/* ---------- Chart.js premium ---------- */
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
      x: {
        min: 0,
        max: 100,
        grid: { color: "rgba(15,23,42,0.06)" },
        border: { display:false },
        ticks: { callback: (v)=>`${v}%` }
      },
      y: { grid: { display:false }, border:{ display:false } }
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
      tooltip: { callbacks: { label: (ctx)=> `${ctx.label}: ${ctx.raw}%` } }
    }
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

/* ---------- Aggregations from filtered rows ---------- */
function counterFromRows(rows, fieldCandidates){
  const c = {};
  for(const r of rows){
    const v = pickField(r, fieldCandidates);
    if(!v) continue;
    for(const part of splitMulti(v)){
      c[part] = (c[part] || 0) + 1;
    }
  }
  return c;
}

function toPercentTop(counterObj, top=10){
  const entries = Object.entries(counterObj || {})
    .filter(([k]) => !isSystemKey(k) && k !== "_missing")
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

function pctYesFromRows(rows, fieldCandidates){
  const c = counterFromRows(rows, fieldCandidates);
  const yes = c["Oui"] || c["OUI"] || c["Yes"] || c["YES"] || 0;
  const total = Object.entries(c).reduce((a,[k,v]) => (k==="_missing"?a:a+Number(v||0)), 0);
  if(!total) return null;
  return Math.round((yes/total)*100);
}

/* ---------- Dashboard sections from questions.json ---------- */
function groupQuestionsBySection(questions){
  const bySection = new Map();
  for(const q of questions){
    if(!bySection.has(q.section)) bySection.set(q.section, []);
    bySection.get(q.section).push(q);
  }
  return { bySection, sectionOrder: Array.from(bySection.keys()) };
}

function renderDashboardSkeleton(questions){
  const sectionsDiv = el("dashboardSections");
  if(!sectionsDiv) return;

  const {bySection, sectionOrder} = groupQuestionsBySection(questions);

  sectionsDiv.innerHTML = sectionOrder.map(sec => {
    const items = bySection.get(sec);

    const cards = items.map((q, idx) => {
      const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
      const top = q.top ?? 10;
      return `
        <div class="chartCard col-6">
          <h3>${escapeHtml(q.title)}</h3>
          <canvas id="${chartId}"></canvas>
          <div class="small">Smart • % • Top ${escapeHtml(top)}</div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-top:12px;">
        <div class="sectionTitle">
          <div>
            <h2 style="margin:0">${escapeHtml(sec)}</h2>
            <p class="subhead">Lecture compacte et comparable.</p>
          </div>
          <span class="sectionChip">Section</span>
        </div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("");
}

/* ---------- Insights (Top forces/gaps) ---------- */
function renderInsights(rows, questions){
  const strong = el("insightsStrong");
  const weak = el("insightsWeak");
  if(!strong || !weak) return;

  const signals = [];

  for(const q of questions){
    const field = q.field;
    if(!field) continue;

    // compute distribution using direct key in row; also support if q.field is nested-like
    const c = {};
    for(const r of rows){
      const v = normalize(r[field]);
      if(!v) continue;
      for(const part of splitMulti(v)){
        c[part] = (c[part] || 0) + 1;
      }
    }

    const hasOui = ("Oui" in c) || ("OUI" in c) || ("Yes" in c) || ("YES" in c);
    const hasNon = ("Non" in c) || ("NON" in c) || ("No" in c) || ("NO" in c);
    const hasVrai = ("Vrai" in c) || ("Faux" in c);

    if((hasOui && hasNon) || hasVrai){
      let pct = null;
      if(hasVrai){
        const total = (c["Vrai"]||0) + (c["Faux"]||0);
        if(total) pct = Math.round(((c["Frai"]||0) / total)*100);
        // NOTE: some datasets may store "Vrai" / "Faux" with exact spelling
        const total2 = (c["Vrai"]||0) + (c["Faux"]||0);
        if(total2) pct = Math.round(((c["Vrai"]||0) / total2)*100);
      } else {
        const yes = c["Oui"] || c["OUI"] || c["Yes"] || c["YES"] || 0;
        const total = Object.entries(c).reduce((a,[k,v]) => a + Number(v||0), 0) || 0;
        if(total) pct = Math.round((yes/total)*100);
      }
      if(pct !== null) signals.push({ title: q.title, pct });
    }
  }

  signals.sort((a,b)=>b.pct-a.pct);
  const topStrong = signals.slice(0, 4);
  const topWeak = signals.slice(-4).reverse();

  const rowHtml = (x, kind)=>`
    <div class="insightRow">
      <div>
        <strong>${escapeHtml(x.title)}</strong>
        <div class="muted" style="font-size:12px;">Signal binaire (% positif)</div>
      </div>
      <div class="pct ${kind === "up" ? "badgeUp" : "badgeDown"}">
        ${x.pct}%
      </div>
    </div>
  `;

  strong.innerHTML = topStrong.length
    ? topStrong.map(x=>rowHtml(x,"up")).join("")
    : `<div class="muted">Pas assez de signaux binaires détectés.</div>`;

  weak.innerHTML = topWeak.length
    ? topWeak.map(x=>rowHtml(x,"down")).join("")
    : `<div class="muted">Pas assez de signaux binaires détectés.</div>`;
}

/* ---------- Table render ---------- */
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

/* ---------- Analysis page: obstacles/actions from filtered rows ---------- */
function buildAnalysisFromFilteredRows(filteredRows, recosPayload){
  // Obstacles
  const cObs = counterFromRows(filteredRows, FIELDS.obstacles);
  const dObs = toPercentTop(cObs, 10);
  createSmartChart("chartTopObstacles", dObs.labels.length?dObs.labels:["—"], dObs.values.length?dObs.values:[0], "Obstacles");

  // Actions
  const cAct = counterFromRows(filteredRows, FIELDS.actions);
  const dAct = toPercentTop(cAct, 10);
  createSmartChart("chartTopActions", dAct.labels.length?dAct.labels:["—"], dAct.values.length?dAct.values:[0], "Actions");

  // Recommendations list (fallback to recos json, else auto from top obstacles/actions)
  const ul = el("globalRecos");
  if(!ul) return;

  const recos = (recosPayload?.recommendations || []).filter(x=>!isSystemKey(x));
  if(recos.length){
    ul.innerHTML = recos.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
    return;
  }

  // Auto-generate (if no recos file)
  const auto = [];
  if(dObs.labels[0] && dObs.labels[0] !== "—"){
    auto.push(`Cibler en priorité : ${dObs.labels.slice(0,3).join(" ; ")}.`);
  }
  if(dAct.labels[0] && dAct.labels[0] !== "—"){
    auto.push(`Actions immédiates recommandées : ${dAct.labels.slice(0,3).join(" ; ")}.`);
  }
  auto.push("Mettre en place un mécanisme de suivi : points focaux genre, indicateurs, reporting trimestriel et revue budgétaire sensible au genre.");
  ul.innerHTML = auto.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
}

/* ---------- Meta ---------- */
function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
}

/* ---------- Main ---------- */
async function main(){
  applyModernChartDefaults();

  const page = document.body.getAttribute("data-page");

  const [questions, allRows, statsMaybe, recos] = await Promise.all([
    loadJson(QUESTIONS),
    loadJson(TABLE),
    loadJson(STATS).catch(()=>null),
    loadJson(RECOS).catch(()=>null)
  ]);

  const generatedAt = statsMaybe?.generated_at || statsMaybe?.meta?.generated_at || null;

  // filter options (from consented rows only for clean filter lists)
  const consented = allRows.filter(isConsented);

  const ministeres = uniq(consented.map(r=>pickField(r, FIELDS.ministere)));
  const sexes = uniq(consented.map(r=>pickField(r, FIELDS.sexe)));
  const fonctions = uniq(consented.map(r=>pickField(r, FIELDS.fonction)));
  const experiences = uniq(consented.map(r=>pickField(r, FIELDS.experience)));
  const formations = uniq(consented.map(r=>pickField(r, FIELDS.formation)));
  const gtgVals = uniq(consented.map(r=>pickField(r, FIELDS.gtgHeard)));

  buildSelect(el("fMinistere"), ministeres);
  buildSelect(el("fSexe"), sexes);
  buildSelect(el("fFonction"), fonctions);
  buildSelect(el("fExperience"), experiences);
  buildSelect(el("fFormation"), formations);
  buildSelect(el("fGTG"), gtgVals);

  const btnReset = el("btnResetFilters");
  if(btnReset){
    btnReset.addEventListener("click", ()=>{
      ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG"].forEach(id=>{
        if(el(id)) el(id).value = "__all__";
      });
      if(el("searchTable")) el("searchTable").value = "";
      refresh();
    });
  }

  // dashboard skeleton once
  if(page === "dashboard"){
    renderDashboardSkeleton(questions);
  }

  // hooks
  ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG","searchTable"].forEach(id=>{
    const x = el(id);
    if(!x) return;
    x.addEventListener(id === "searchTable" ? "input" : "change", refresh);
  });

  function refresh(){
    const f = getCurrentFilters();
    renderChips(f);

    const filteredRows = allRows.filter(r=>matchRow(r, f));
    setMeta(generatedAt, filteredRows.length);

    if(page === "responses"){
      buildTable(filteredRows, allRows);
      return;
    }

    if(page === "dashboard"){
      if(el("kpiN")) el("kpiN").textContent = filteredRows.length;

      // KPI aligned to questionnaire
      if(el("kpiFormation")) el("kpiFormation").textContent = formatPct(pctYesFromRows(filteredRows, FIELDS.formation));
      if(el("kpiDiff")) el("kpiDiff").textContent = formatPct(pctYesFromRows(filteredRows, FIELDS.diffSexeGenre));
      if(el("kpiCellule")) el("kpiCellule").textContent = formatPct(pctYesFromRows(filteredRows, FIELDS.celluleGenre));

      // charts per question from questions.json (field must match row keys)
      const {bySection, sectionOrder} = groupQuestionsBySection(questions);
      sectionOrder.forEach(sec=>{
        const items = bySection.get(sec);
        items.forEach((q, idx)=>{
          const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
          const top = q.top ?? 10;

          const counter = {};
          for(const r of filteredRows){
            const v = normalize(r[q.field]);
            if(!v) continue;
            for(const part of splitMulti(v)){
              counter[part] = (counter[part] || 0) + 1;
            }
          }
          const d = toPercentTop(counter, top);
          createSmartChart(chartId, d.labels.length?d.labels:["—"], d.values.length?d.values:[0], q.title);
        });
      });

      renderInsights(filteredRows, questions);
      return;
    }

    if(page === "analysis"){
      buildAnalysisFromFilteredRows(filteredRows, recos);
      return;
    }
  }

  refresh();
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
