const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";
const STATS = "data/stats.json"; // optionnel

function el(id){ return document.getElementById(id); }

/* ---------- UI Error Banner ---------- */
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
    <div style="opacity:.9; margin-top:6px">
      Ouvre la console (F12) pour voir l’erreur exacte (404/JSON).
    </div>
  `;
}

async function loadJson(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok){
    throw new Error(`Fetch failed ${r.status} — ${path}`);
  }
  return r.json();
}

/* ---------- Robust unwrap ---------- */
function unwrapArray(payload){
  if(Array.isArray(payload)) return payload;
  if(payload && Array.isArray(payload.data)) return payload.data;
  if(payload && Array.isArray(payload.results)) return payload.results;
  if(payload && Array.isArray(payload.questions)) return payload.questions;
  // fallback: if object map, return entries as array (rare)
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

function formatDateISO(s){
  if(!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR");
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

/* ---------- Safe slug for IDs (no accents) ---------- */
function slug(s){
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ---------- System fields removal ---------- */
const SYSTEM_KEYS = new Set([
  "_missing","_id","_uuid","_index","_submission_time","_submitted_by",
  "_validation_status","_notes","formhub/uuid","_attachments"
]);
function isSystemKey(k){
  const s = String(k ?? "").trim();
  if(!s) return true;
  if(SYSTEM_KEYS.has(s)) return true;
  if(s.startsWith("_")) return true;
  return false;
}
function headerLabel(c){
  return String(c).replaceAll("_"," ").replaceAll("/"," • ");
}

/* ---------- Multi select split ---------- */
function splitMulti(val){
  const s = normalize(val);
  if(!s) return [];
  if(/[;,|\n]/.test(s)){
    return s.split(/[;,|\n]+/).map(x=>x.trim()).filter(Boolean);
  }
  return [s];
}

/* ---------- Field candidates (adaptables) ---------- */
const FIELDS = {
  consent: ["consent","intro/consent","consentement"],

  ministere: ["ministere","intro/ministere","ministere_sg","ministere_ou_sg"],
  sexe: ["sexe","intro/sexe"],
  fonction: ["fonction","intro/fonction","fonction_actuelle"],
  experience: [
    "annees_experience_ministere","intro/annees_experience_ministere",
    "experience_ministere","experience","annees_experience"
  ],
  formation: ["formation_genre","intro/formation_genre","a_suivi_formation_genre"],

  diffSexeGenre: ["diff_sexe_genre","difference_sexe_genre","connaissance_diff_sexe_genre"],
  celluleGenre: ["cellule_genre","presence_cellule_genre","dispose_cellule_genre"],

  obstacles: ["obstacles","principaux_obstacles","obstacles_integration_genre","obstacles_genre"],
  actions: ["actions_prioritaires","actions","actions_pour_ameliorer","actions_integration_genre"],

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
  if(!v) return true;
  return (v === "oui" || v === "yes" || v === "true");
}

/* ---------- Filters ---------- */
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

/* ---------- Charts ---------- */
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

/* ---------- Counters + % ---------- */
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

function pctYesFromCandidates(rows, candidates){
  const c = counterFromCandidates(rows, candidates);
  const keys = Object.keys(c).map(x=>String(x).toLowerCase());
  const hasOui = keys.includes("oui") || keys.includes("yes") || keys.includes("true");
  if(!hasOui) return null;

  const total = Object.entries(c).reduce((a,[k,v]) => a + Number(v||0), 0);
  if(!total) return null;

  let yes = 0;
  for(const [k,v] of Object.entries(c)){
    const kk = String(k).toLowerCase();
    if(kk === "oui" || kk === "yes" || kk === "true") yes += Number(v||0);
  }
  return Math.round((yes/total)*100);
}

/* ---------- Questions sections ---------- */
function groupQuestionsBySection(questions){
  const bySection = new Map();
  for(const q of questions){
    if(!q || !q.section || !q.title || !q.field) continue;
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
      const chartId = `chart_${slug(sec)}_${idx}`;
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

/* ---------- Table ---------- */
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

/* ---------- Meta ---------- */
function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
}

/* ---------- Main ---------- */
async function main(){
  try{
    applyModernChartDefaults();

    const page = document.body.getAttribute("data-page");
    console.log("APP START page=", page);

    // load (with per-file diagnostics)
    const qPayload = await loadJson(QUESTIONS).catch(e => { throw new Error(`questions.json: ${e.message}`); });
    const tPayload = await loadJson(TABLE).catch(e => { throw new Error(`submissions_table.json: ${e.message}`); });
    const statsMaybe = await loadJson(STATS).catch(()=>null);
    const recos = await loadJson(RECOS).catch(()=>null);

    const questions = unwrapArray(qPayload);
    const allRows = unwrapArray(tPayload);

    if(!questions) throw new Error("questions.json n'est pas un tableau (array) ni {data:[…]} / {questions:[…]}");
    if(!allRows) throw new Error("submissions_table.json n'est pas un tableau (array) ni {data:[…]} / {results:[…]}");

    if(!Array.isArray(questions) || !questions.length) throw new Error("questions.json est vide ou invalide");
    if(!Array.isArray(allRows)) throw new Error("submissions_table.json invalide (doit être array d'objets)");

    console.log("Loaded:", { questions: questions.length, rows: allRows.length });

    const generatedAt = statsMaybe?.generated_at || statsMaybe?.meta?.generated_at || null;

    const consented = allRows.filter(isConsented);

    // options
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

    // reset
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

    // hooks
    ["fMinistere","fSexe","fFonction","fExperience","fFormation","fGTG","searchTable"].forEach(id=>{
      const x = el(id);
      if(!x) return;
      x.addEventListener(id === "searchTable" ? "input" : "change", refresh);
    });

    function refresh(){
      try{
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

          const k1 = pctYesFromCandidates(filteredRows, FIELDS.formation);
          const k2 = pctYesFromCandidates(filteredRows, FIELDS.diffSexeGenre);
          const k3 = pctYesFromCandidates(filteredRows, FIELDS.celluleGenre);

          if(el("kpiFormation")) el("kpiFormation").textContent = k1 === null ? "—" : `${k1}%`;
          if(el("kpiDiff")) el("kpiDiff").textContent = k2 === null ? "—" : `${k2}%`;
          if(el("kpiCellule")) el("kpiCellule").textContent = k3 === null ? "—" : `${k3}%`;

          // charts
          const {bySection, sectionOrder} = groupQuestionsBySection(questions);
          sectionOrder.forEach(sec=>{
            const items = bySection.get(sec);
            items.forEach((q, idx)=>{
              const chartId = `chart_${slug(sec)}_${idx}`;
              const top = q.top ?? 10;

              // IMPORTANT: q.field doit exister exactement dans submissions_table.json
              const c = counterByExactField(filteredRows, q.field);
              const d = toPercentTop(c, top);

              createSmartChart(
                chartId,
                d.labels.length ? d.labels : ["—"],
                d.values.length ? d.values : [0],
                q.title
              );
            });
          });
          return;
        }

        if(page === "analysis"){
          // obstacles / actions (si canvas existent)
          const cObs = counterFromCandidates(filteredRows, FIELDS.obstacles);
          const dObs = toPercentTop(cObs, 10);
          createSmartChart("chartTopObstacles", dObs.labels.length?dObs.labels:["—"], dObs.values.length?dObs.values:[0], "Obstacles");

          const cAct = counterFromCandidates(filteredRows, FIELDS.actions);
          const dAct = toPercentTop(cAct, 10);
          createSmartChart("chartTopActions", dAct.labels.length?dAct.labels:["—"], dAct.values.length?dAct.values:[0], "Actions");

          const ul = el("globalRecos");
          if(ul){
            const list = (recos?.recommendations || []);
            ul.innerHTML = list.length
              ? list.map(x=>`<li>${escapeHtml(x)}</li>`).join("")
              : `<li>Recommandations non disponibles (fichier recommendations_global.json absent ou vide).</li>`;
          }
          return;
        }
      } catch(e){
        showFatal("Erreur dans refresh()", e.message);
      }
    }

    refresh();

  } catch(e){
    showFatal("Impossible d'initialiser le dashboard", e.message);
  }
}

main();
