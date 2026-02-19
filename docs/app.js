const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";
const STATS = "data/stats.json"; // optional

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

/* ---------------- Exclure champs systèmes ---------------- */
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

/* ---------------- Multi-sélection ---------------- */
function splitMulti(val){
  const s = normalize(val);
  if(!s) return [];
  if(/[;,|\n]/.test(s)){
    return s.split(/[;,|\n]+/).map(x=>x.trim()).filter(Boolean);
  }
  return [s];
}

/* ---------------- Mapping champs (ROBUSTE pour vos colonnes) ---------------- */
const FIELDS = {
  consent: ["consent","intro/consent","consentement"],

  ministere: ["ministere","intro/ministere","sec1/ministere","ministere_sg","ministere_ou_sg"],
  sexe: ["sexe","intro/sexe"],
  fonction: ["fonction","intro/fonction","fonction_actuelle"],
  experience: [
    "annees_experience_ministere","intro/annees_experience_ministere",
    "experience_ministere","experience","annees_experience",
    "nombre_annees_experience","annees_experience_au_ministere"
  ],
  formation: ["formation_genre","intro/formation_genre","a_suivi_formation_genre","formation_sur_le_genre"],

  // Knowledge / practices (vos libellés)
  diffSexeGenre: ["diff_sexe_genre","connaissance_diff_sexe_genre","difference_sexe_genre"],
  celluleGenre: ["cellule_genre","presence_cellule_genre","dispose_cellule_genre"],
  politiquesConnues: ["politiques_genre_connaissance","connaissance_politique_genre"],
  planGenre: ["plan_strategie_genre","plan_genre","strategie_genre"],
  indicateurs: ["indicateurs_genre","indicateurs_sensibles_genre","integration_indicateurs_genre"],
  outilsGuides: ["outils_guides_genre","outils_genre","acces_outils_genre"],

  // Obstacles/actions
  obstacles: ["obstacles","principaux_obstacles","obstacles_integration_genre","obstacles_genre"],
  actions: ["actions_prioritaires","actions","actions_pour_ameliorer","actions_integration_genre"],

  // GTG
  gtgHeard: ["gtg","gtg_connu","entendu_gtg","a_entendu_parler_gtg"],
  gtgSubgroups: ["gtg_sous_groupes","sous_groupes_gtg","sous_groupes_connus"]
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

function isConsented(row){
  const v = pickField(row, FIELDS.consent).toLowerCase();
  if(!v) return true; // si champ absent, on ne bloque pas
  return (v === "oui" || v === "yes" || v === "true");
}

/* ---------------- Filtres ---------------- */
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

/* ---------------- Charts (smart) ---------------- */
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
        min: 0, max: 100,
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

/* ---------------- Stats helpers ---------------- */
function counterByExactField(rows, field){
  const c = {};
  for(const r of rows){
    const v = normalize(r[field]);
    if(!v) continue;
    for(const part of splitMulti(v)){
      c[part] = (c[part] || 0) + 1;
    }
  }
  return c;
}

function counterFromCandidates(rows, candidates){
  const c = {};
  for(const r of rows){
    const v = pickField(r, candidates);
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

function pctPositive(counterObj, positiveSet){
  const total = Object.entries(counterObj).reduce((a,[k,v]) => (k==="_missing"?a:a+Number(v||0)), 0);
  if(!total) return null;
  let pos = 0;
  for(const [k,v] of Object.entries(counterObj)){
    if(positiveSet.has(String(k).toLowerCase())) pos += Number(v||0);
  }
  return Math.round((pos/total)*100);
}

/* ---------------- Dashboard skeleton (from questions.json) ---------------- */
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

/* ---------------- Insights (ROBUSTE) ----------------
   - détecte Oui/Non, Vrai/Faux, Yes/No
   - calcule un "% positif" et classe Top forces / Top gaps
*/
function renderInsights(rows, questions){
  const strong = el("insightsStrong");
  const weak = el("insightsWeak");
  if(!strong || !weak) return;

  const yesSet = new Set(["oui","yes","true"]);
  const noSet = new Set(["non","no","false"]);
  const vraiSet = new Set(["vrai"]);
  const fauxSet = new Set(["faux"]);

  const signals = [];

  for(const q of questions){
    if(!q.field) continue;

    const c = counterByExactField(rows, q.field);
    const keys = new Set(Object.keys(c).map(k=>String(k).toLowerCase()));

    const hasYesNo = [...keys].some(k=>yesSet.has(k)) && [...keys].some(k=>noSet.has(k));
    const hasVraiFaux = keys.has("vrai") && keys.has("faux");

    if(!(hasYesNo || hasVraiFaux)) continue;

    // par défaut: positif=Oui, et pour Vrai/Faux: positif=Vrai
    // heuristique utile: si question contient "principalement biologique" -> positif = Faux
    let positive = yesSet;
    if(hasVraiFaux){
      const title = (q.title || "").toLowerCase();
      positive = title.includes("biologique") ? fauxSet : vraiSet;
    }

    const pct = pctPositive(c, positive);
    if(pct !== null) signals.push({ title: q.title, pct });
  }

  signals.sort((a,b)=>b.pct-a.pct);

  const topStrong = signals.slice(0, 4);
  const topWeak = signals.slice(-4).reverse();

  const rowHtml = (x, kind)=>`
    <div class="insightRow">
      <div>
        <strong>${escapeHtml(x.title)}</strong>
        <div class="muted" style="font-size:12px;">% réponse “positive”</div>
      </div>
      <div class="pct ${kind === "up" ? "badgeUp" : "badgeDown"}">
        ${x.pct}%
      </div>
    </div>
  `;

  strong.innerHTML = topStrong.length
    ? topStrong.map(x=>rowHtml(x,"up")).join("")
    : `<div class="muted">Aucun signal binaire détecté (vérifier les valeurs Oui/Non, Vrai/Faux).</div>`;

  weak.innerHTML = topWeak.length
    ? topWeak.map(x=>rowHtml(x,"down")).join("")
    : `<div class="muted">Aucun signal binaire détecté (vérifier les valeurs Oui/Non, Vrai/Faux).</div>`;
}

/* ---------------- Table render ---------------- */
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

/* ---------------- Analysis charts from filtered rows ---------------- */
function buildAnalysisFromFilteredRows(filteredRows, recosPayload){
  const cObs = counterFromCandidates(filteredRows, FIELDS.obstacles);
  const dObs = toPercentTop(cObs, 10);
  createSmartChart("chartTopObstacles", dObs.labels.length?dObs.labels:["—"], dObs.values.length?dObs.values:[0], "Obstacles");

  const cAct = counterFromCandidates(filteredRows, FIELDS.actions);
  const dAct = toPercentTop(cAct, 10);
  createSmartChart("chartTopActions", dAct.labels.length?dAct.labels:["—"], dAct.values.length?dAct.values:[0], "Actions");

  const ul = el("globalRecos");
  if(!ul) return;

  const recos = (recosPayload?.recommendations || []).filter(x=>!isSystemKey(x));
  if(recos.length){
    ul.innerHTML = recos.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
    return;
  }

  // fallback auto si fichier recos absent
  const auto = [];
  if(dObs.labels[0] && dObs.labels[0] !== "—") auto.push(`Cibler en priorité : ${dObs.labels.slice(0,3).join(" ; ")}.`);
  if(dAct.labels[0] && dAct.labels[0] !== "—") auto.push(`Actions immédiates : ${dAct.labels.slice(0,3).join(" ; ")}.`);
  auto.push("Formaliser un dispositif de suivi : points focaux genre, indicateurs, reporting trimestriel, revue budgétaire sensible au genre.");
  ul.innerHTML = auto.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
}

/* ---------------- Meta ---------------- */
function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
}

/* ---------------- Main ---------------- */
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

  const consented = allRows.filter(isConsented);

  // options filtres
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

  if(page === "dashboard"){
    renderDashboardSkeleton(questions);
  }

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

      // ✅ KPI alignés sur vos VRAIS champs
      if(el("kpiFormation")) el("kpiFormation").textContent = formatPct(pctPositive(counterFromCandidates(filteredRows, FIELDS.formation), new Set(["oui","yes","true"])));
      if(el("kpiDiff")) el("kpiDiff").textContent = formatPct(pctPositive(counterFromCandidates(filteredRows, FIELDS.diffSexeGenre), new Set(["oui","yes","true"])));
      if(el("kpiCellule")) el("kpiCellule").textContent = formatPct(pctPositive(counterFromCandidates(filteredRows, FIELDS.celluleGenre), new Set(["oui","yes","true"])));

      // charts questions.json (field doit matcher une colonne)
      const {bySection, sectionOrder} = groupQuestionsBySection(questions);

      sectionOrder.forEach(sec=>{
        const items = bySection.get(sec);
        items.forEach((q, idx)=>{
          const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
          const top = q.top ?? 10;
          const c = counterByExactField(filteredRows, q.field);
          const d = toPercentTop(c, top);
          createSmartChart(chartId, d.labels.length?d.labels:["—"], d.values.length?d.values:[0], q.title);
        });
      });

      // ✅ Insights robustes
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
