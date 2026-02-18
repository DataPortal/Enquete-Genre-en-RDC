// ---------- Paths ----------
const QUESTIONS = "data/questions.json";
const TABLE = "data/submissions_table.json";
const RECOS = "data/recommendations_global.json";
const STATS = "data/stats.json"; // utilisé seulement pour generated_at si présent

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

/* ---------- System filters ---------- */
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

function normalize(v){
  if(v === null || v === undefined) return "";
  return String(v).trim();
}

function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b, "fr"));
}

function buildSelect(selectEl, values){
  if(!selectEl) return;
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "__all__";
  optAll.textContent = "Tous";
  selectEl.appendChild(optAll);

  values.forEach(v=>{
    const o=document.createElement("option");
    o.value=v; o.textContent=v;
    selectEl.appendChild(o);
  });
}

/* ---------- Smart splitting for multi-select ---------- */
function splitMulti(val){
  const s = normalize(val);
  if(!s) return [];
  // support ; , | and line breaks
  if(/[;,|\n]/.test(s)){
    return s.split(/[;,|\n]+/).map(x=>x.trim()).filter(Boolean);
  }
  return [s];
}

/* ---------- Filters mapping (adapt if your column names differ) ---------- */
const FIELDS = {
  province: ["intro/province","province"],
  sexe: ["sexe","intro/sexe"],
  ministere: ["ministere","intro/ministere"],
  orgType: ["intro/org_type","org_type","type_organisation"],
  cluster: ["intro/cluster","cluster","secteur"]
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

function computeFilterOptions(rows){
  const provinces = uniq(rows.map(r=>pickField(r, FIELDS.province)));
  const sexes = uniq(rows.map(r=>pickField(r, FIELDS.sexe)));
  const ministeres = uniq(rows.map(r=>pickField(r, FIELDS.ministere)));
  const orgTypes = uniq(rows.map(r=>pickField(r, FIELDS.orgType)));
  const clusters = uniq(rows.map(r=>pickField(r, FIELDS.cluster)));
  return { provinces, sexes, ministeres, orgTypes, clusters };
}

function getCurrentFilters(){
  return {
    province: el("fProvince")?.value || "__all__",
    sexe: el("fSexe")?.value || "__all__",
    ministere: el("fMinistere")?.value || "__all__",
    orgType: el("fOrgType")?.value || "__all__",
    cluster: el("fCluster")?.value || "__all__",
    search: el("searchTable")?.value?.trim().toLowerCase() || ""
  };
}

function matchRow(row, f){
  const prov = pickField(row, FIELDS.province);
  const sexe = pickField(row, FIELDS.sexe);
  const min = pickField(row, FIELDS.ministere);
  const org = pickField(row, FIELDS.orgType);
  const clu = pickField(row, FIELDS.cluster);

  if(f.province !== "__all__" && prov !== f.province) return false;
  if(f.sexe !== "__all__" && sexe !== f.sexe) return false;
  if(f.ministere !== "__all__" && min !== f.ministere) return false;
  if(f.orgType !== "__all__" && org !== f.orgType) return false;
  if(f.cluster !== "__all__" && clu !== f.cluster) return false;

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
  if(filters.province !== "__all__") items.push(["Province", filters.province]);
  if(filters.sexe !== "__all__") items.push(["Sexe", filters.sexe]);
  if(filters.ministere !== "__all__") items.push(["Ministère", filters.ministere]);
  if(filters.orgType !== "__all__") items.push(["Type org", filters.orgType]);
  if(filters.cluster !== "__all__") items.push(["Cluster", filters.cluster]);
  if(filters.search) items.push(["Recherche", filters.search]);

  chips.innerHTML = items.length
    ? items.map(([k,v])=>`<span class="chip"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`).join("")
    : `<span class="chip"><strong>Filtres:</strong> Aucun (vue complète)</span>`;
}

/* ---------- Chart.js modern look ---------- */
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
  g.addColorStop(0, "rgba(47,128,237,0.85)");
  g.addColorStop(1, "rgba(106,90,224,0.85)");
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
          if(!chartArea) return "rgba(47,128,237,0.8)";
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
function counterFromRows(rows, field){
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

function pctYesFromRows(rows, field){
  const c = counterFromRows(rows, field);
  const yes = c["Oui"] || c["OUI"] || c["Yes"] || c["YES"] || 0;
  const total = Object.entries(c).reduce((a,[k,v]) => (k==="_missing"?a:a+Number(v||0)), 0);
  if(!total) return null;
  return Math.round((yes/total)*100);
}

/* ---------- Render: Dashboard sections ---------- */
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
            <p class="subhead">Lecture compacte et comparable entre questions.</p>
          </div>
          <span class="sectionChip">Section</span>
        </div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("");
}

/* ---------- Insights (forces/gaps) ---------- */
function renderInsights(rows, questions){
  const strong = el("insightsStrong");
  const weak = el("insightsWeak");
  if(!strong || !weak) return;

  // heuristique: questions binaires Oui/Non => signal
  const signals = [];
  for(const q of questions){
    const field = q.field;
    if(!field) continue;

    // calc distribution
    const c = counterFromRows(rows, field);
    const hasOui = ("Oui" in c) || ("OUI" in c) || ("Yes" in c);
    const hasNon = ("Non" in c) || ("NON" in c) || ("No" in c);

    if(hasOui && hasNon){
      const pctYes = pctYesFromRows(rows, field);
      if(pctYes !== null){
        signals.push({ title: q.title, pct: pctYes });
      }
    }
  }

  signals.sort((a,b)=>b.pct-a.pct);

  const topStrong = signals.slice(0, 4);
  const topWeak = signals.slice(-4).reverse();

  const rowHtml = (x, kind)=>`
    <div class="insightRow">
      <div>
        <strong>${escapeHtml(x.title)}</strong>
        <div class="muted" style="font-size:12px;">Signal binaire (Oui/Non)</div>
      </div>
      <div class="pct ${kind === "up" ? "badgeUp" : "badgeDown"}">
        ${x.pct}% <span class="muted">Oui</span>
      </div>
    </div>
  `;

  strong.innerHTML = topStrong.length ? topStrong.map(x=>rowHtml(x,"up")).join("") : `<div class="muted">Pas assez de signaux binaires détectés.</div>`;
  weak.innerHTML = topWeak.length ? topWeak.map(x=>rowHtml(x,"down")).join("") : `<div class="muted">Pas assez de signaux binaires détectés.</div>`;
}

/* ---------- Table render ---------- */
function buildTable(rows, allRows){
  const thead = el("thead");
  const tbody = el("tbody");
  const nShown = el("nShown");
  if(!thead || !tbody) return;

  // keep only non-system columns
  const cols = allRows.length ? Object.keys(allRows[0]).filter(c => !isSystemKey(c)) : [];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(headerLabel(c))}</th>`).join("")}</tr>`;

  const render = (data) => {
    if(nShown) nShown.textContent = data.length;
    tbody.innerHTML = data.map(r => {
      return `<tr>${cols.map(c => {
        const v = r[c];
        const s = normalize(v);
        return s ? `<td>${escapeHtml(s)}</td>` : `<td class="muted">—</td>`;
      }).join("")}</tr>`;
    }).join("");
  };

  render(rows);
}

/* ---------- Analysis charts ---------- */
function buildAnalysisFromFilteredRows(filteredRows, globalRecosPayload){
  // obstacles/actions are expected inside recommendations_global.json
  const obstacles = globalRecosPayload?.top_obstacles || [];
  const actions = globalRecosPayload?.top_actions || [];

  // If you also have obstacle/action fields in TABLE, you can switch to that later.
  // For now: show % within listed items (still useful & clean)
  const oTotal = obstacles.reduce((a,x)=>a + Number(x.count||0),0) || 1;
  const oLabels = obstacles.map(x=>x.label).filter(l=>!isSystemKey(l)).slice(0,10);
  const oVals = obstacles.slice(0, oLabels.length).map(x=>Math.round((Number(x.count||0)/oTotal)*100));
  createSmartChart("chartTopObstacles", oLabels.length?oLabels:["—"], oLabels.length?oVals:[0], "Top obstacles");

  const aTotal = actions.reduce((a,x)=>a + Number(x.count||0),0) || 1;
  const aLabels = actions.map(x=>x.label).filter(l=>!isSystemKey(l)).slice(0,10);
  const aVals = actions.slice(0, aLabels.length).map(x=>Math.round((Number(x.count||0)/aTotal)*100));
  createSmartChart("chartTopActions", aLabels.length?aLabels:["—"], aLabels.length?aVals:[0], "Top actions");

  const ul = el("globalRecos");
  if(ul){
    const recos = (globalRecosPayload?.recommendations || []).filter(x=>!isSystemKey(x));
    ul.innerHTML = recos.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
  }
}

/* ---------- Meta ---------- */
function setMeta(generatedAt, n){
  if(el("lastUpdate")) el("lastUpdate").textContent = formatDateISO(generatedAt || new Date().toISOString());
  if(el("nResponses")) el("nResponses").textContent = n ?? "—";
}

/* ---------- Main orchestration ---------- */
async function main(){
  applyModernChartDefaults();

  const page = document.body.getAttribute("data-page");

  // Load core data once
  const [questions, allRows, statsMaybe, recos] = await Promise.all([
    loadJson(QUESTIONS),
    loadJson(TABLE),
    loadJson(STATS).catch(()=>null),
    loadJson(RECOS).catch(()=>null)
  ]);

  const generatedAt = statsMaybe?.generated_at || statsMaybe?.meta?.generated_at || null;

  // Build filter options
  const opts = computeFilterOptions(allRows);
  buildSelect(el("fProvince"), opts.provinces);
  buildSelect(el("fSexe"), opts.sexes);
  buildSelect(el("fMinistere"), opts.ministeres);
  buildSelect(el("fOrgType"), opts.orgTypes);
  buildSelect(el("fCluster"), opts.clusters);

  // Reset button
  const btnReset = el("btnResetFilters");
  if(btnReset){
    btnReset.addEventListener("click", ()=>{
      if(el("fProvince")) el("fProvince").value="__all__";
      if(el("fSexe")) el("fSexe").value="__all__";
      if(el("fMinistere")) el("fMinistere").value="__all__";
      if(el("fOrgType")) el("fOrgType").value="__all__";
      if(el("fCluster")) el("fCluster").value="__all__";
      if(el("searchTable")) el("searchTable").value="";
      refresh();
    });
  }

  // Dashboard skeleton once
  if(page === "dashboard"){
    renderDashboardSkeleton(questions);
  }

  // Hooks: any filter change refreshes
  const hookIds = ["fProvince","fSexe","fMinistere","fOrgType","fCluster","searchTable"];
  hookIds.forEach(id=>{
    const x = el(id);
    if(!x) return;
    x.addEventListener(id === "searchTable" ? "input" : "change", refresh);
  });

  function refresh(){
    const f = getCurrentFilters();
    renderChips(f);

    const filteredRows = allRows.filter(r=>matchRow(r, f));
    setMeta(generatedAt, filteredRows.length);

    // Responses page
    if(page === "responses"){
      buildTable(filteredRows, allRows);
      return;
    }

    // Dashboard page
    if(page === "dashboard"){
      // KPI from known fields (adjust if your keys differ)
      if(el("kpiN")) el("kpiN").textContent = filteredRows.length;

      // These KPI fields should match your questionnaire; adjust if needed
      const pctFormation = pctYesFromRows(filteredRows, "sec1/formation_genre");
      const pctCellule = pctYesFromRows(filteredRows, "sec3/cellule_genre");
      const pctPol = pctYesFromRows(filteredRows, "sec2/politiques_genre_connaissance");

      if(el("kpiFormation")) el("kpiFormation").textContent = formatPct(pctFormation);
      if(el("kpiCellule")) el("kpiCellule").textContent = formatPct(pctCellule);
      if(el("kpiPol")) el("kpiPol").textContent = formatPct(pctPol);

      // charts per question computed from filtered rows
      const {bySection, sectionOrder} = groupQuestionsBySection(questions);

      sectionOrder.forEach(sec=>{
        const items = bySection.get(sec);
        items.forEach((q, idx)=>{
          const chartId = `chart_${sec.replaceAll(" ","_")}_${idx}`;
          const field = q.field;
          const top = q.top ?? 10;

          // count from filteredRows
          const c = counterFromRows(filteredRows, field);
          const d = toPercentTop(c, top);

          if(!d.labels.length){
            createSmartChart(chartId, ["—"], [0], q.title);
          } else {
            createSmartChart(chartId, d.labels, d.values, q.title);
          }
        });
      });

      // Insights panel (forces/gaps)
      renderInsights(filteredRows, questions);
      return;
    }

    // Analysis page
    if(page === "analysis"){
      buildAnalysisFromFilteredRows(filteredRows, recos);
      return;
    }
  }

  // First render
  refresh();
}

main().catch(err => {
  console.error(err);
  alert("Erreur chargement données. Ouvre la console (F12) pour voir le détail.");
});
