/* Lendlens – frontend logic
 * Same-origin by default (FastAPI serves this folder). If you host the UI
 * somewhere else, set API_BASE to your backend URL, e.g. "https://my-api.onrender.com".
 */
const API_BASE = "";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const form = $("#form");
const panel = $("#panel");
const needle = $("#needle");
const cutoff = $("#cutoff");
const fillArc = $("#fillArc");
const probNum = $("#probNum");
const probCaption = $("#probCaption");
const badge = $("#badge");
const explain = $("#explain");
const facts = $("#facts");
const submitBtn = $("#submitBtn");
const autoBtn = $("#autoBtn");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const history = [];
let pctTouched = false;
let countRaf = 0;

/* ---------- Dial setup ---------- */
// Tick marks every 10% on the arc
(() => {
  const g = $("#ticks");
  for (let i = 1; i < 10; i++) {
    const a = (-90 + i * 18) * Math.PI / 180;
    const x1 = 150 + Math.sin(a) * 110, y1 = 150 - Math.cos(a) * 110;
    const x2 = 150 + Math.sin(a) * 130, y2 = 150 - Math.cos(a) * 130;
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("class", "tick");
    g.appendChild(l);
  }
})();

// After the intro sweep, hand control to JS-driven transitions
const markReady = () => panel.setAttribute("data-ready", "");
setTimeout(markReady, reduceMotion ? 0 : 1700);

const angleFor = (p) => -90 + Math.max(0, Math.min(1, p)) * 180;

function setDial(p, thr) {
  markReady();
  needle.style.transform = `rotate(${angleFor(p)}deg)`;
  fillArc.style.transition = `stroke-dashoffset ${reduceMotion ? 0 : 1.4}s cubic-bezier(0.22, 1, 0.36, 1)`;
  fillArc.style.strokeDashoffset = String(100 - p * 100);
  if (thr != null) {
    cutoff.style.transform = `rotate(${angleFor(thr)}deg)`;
    cutoff.setAttribute("opacity", "1");
  }
}

function resetDial() {
  needle.style.transform = "rotate(-90deg)";
  fillArc.style.strokeDashoffset = "100";
  cutoff.setAttribute("opacity", "0");
}

function countTo(target, duration = 1300) {
  cancelAnimationFrame(countRaf);
  if (reduceMotion) { probNum.textContent = target.toFixed(1); return; }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    probNum.textContent = (target * eased).toFixed(1);
    if (t < 1) countRaf = requestAnimationFrame(tick);
  };
  countRaf = requestAnimationFrame(tick);
}

/* ---------- Grade chips ---------- */
const gradesEl = $("#grades");
["A", "B", "C", "D", "E", "F", "G"].forEach((g) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = g;
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", "false");
  b.dataset.value = g;
  b.addEventListener("click", () => setGrade(g));
  gradesEl.appendChild(b);
});

function setGrade(g) {
  form.elements.loan_grade.value = g || "";
  $$(".chip", gradesEl).forEach((c) => c.setAttribute("aria-checked", String(c.dataset.value === g)));
  if (g) clearError(form.elements.loan_grade);
}

/* ---------- Yes / No segmented control ---------- */
const seg = $("#defaultSeg");
$$("button", seg).forEach((b) => b.addEventListener("click", () => setDefaultFlag(b.dataset.value)));

function setDefaultFlag(v) {
  form.elements.cb_person_default_on_file.value = v || "";
  if (v) seg.dataset.value = v; else delete seg.dataset.value;
  $$("button", seg).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === v)));
  if (v) clearError(form.elements.cb_person_default_on_file);
}

/* ---------- Loan share of income (auto-calculated) ---------- */
function autoPct() {
  if (pctTouched) return;
  const inc = parseFloat(form.elements.person_income.value);
  const amt = parseFloat(form.elements.loan_amnt.value);
  const out = form.elements.loan_percent_income;
  if (inc > 0 && amt >= 0) {
    out.value = (amt / inc).toFixed(2);
    clearError(out);
  } else {
    out.value = "";
  }
}
["person_income", "loan_amnt"].forEach((n) => form.elements[n].addEventListener("input", autoPct));
form.elements.loan_percent_income.addEventListener("input", () => { pctTouched = true; autoBtn.hidden = false; });
autoBtn.addEventListener("click", () => { pctTouched = false; autoBtn.hidden = true; autoPct(); });

/* ---------- Validation ---------- */
const rules = {
  person_age:                 { min: 18, max: 100, int: true, msg: "Enter an age between 18 and 100." },
  person_income:              { min: 1, msg: "Enter an annual income above 0." },
  person_home_ownership:      { msg: "Choose a home ownership type." },
  person_emp_length:          { min: 0, max: 60, msg: "Enter years employed, from 0 to 60." },
  loan_intent:                { msg: "Choose what the loan is for." },
  loan_grade:                 { msg: "Pick a loan grade." },
  loan_amnt:                  { min: 1, msg: "Enter a loan amount above 0." },
  loan_int_rate:              { min: 0, max: 40, msg: "Enter an interest rate from 0 to 40." },
  loan_percent_income:        { min: 0, max: 1.5, msg: "Enter a share between 0 and 1.5 (0.25 = 25%)." },
  cb_person_default_on_file:  { msg: "Say whether the applicant has defaulted before." },
  cb_person_cred_hist_length: { min: 0, max: 80, int: true, msg: "Enter whole years of credit history." },
};

function fieldWrap(el) { return el.closest(".field"); }
function clearError(el) { fieldWrap(el)?.classList.remove("invalid"); }
function showError(el, msg) {
  const w = fieldWrap(el);
  w.classList.add("invalid");
  $(".err", w).textContent = msg;
  w.classList.remove("shake"); void w.offsetWidth; w.classList.add("shake");
}

function validate() {
  let firstBad = null;
  for (const [name, r] of Object.entries(rules)) {
    const el = form.elements[name];
    const raw = String(el.value).trim();
    let ok = raw !== "";
    if (ok && (r.min !== undefined || r.max !== undefined)) {
      const n = Number(raw);
      ok = Number.isFinite(n) && (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max) && (!r.int || Number.isInteger(n));
    }
    if (!ok) { showError(el, r.msg); firstBad = firstBad || el; } else clearError(el);
  }
  return firstBad;
}

$$("input, select", form).forEach((el) => {
  el.addEventListener("input", () => clearError(el));
  el.addEventListener("change", () => clearError(el));
});

/* ---------- Submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bad = validate();
  if (bad) {
    (bad.type === "hidden" ? fieldWrap(bad) : bad).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    if (bad.type !== "hidden") bad.focus({ preventScroll: true });
    return;
  }

  const payload = {
    person_age: parseInt(form.elements.person_age.value, 10),
    person_income: parseFloat(form.elements.person_income.value),
    person_home_ownership: form.elements.person_home_ownership.value,
    person_emp_length: parseFloat(form.elements.person_emp_length.value),
    loan_intent: form.elements.loan_intent.value,
    loan_grade: form.elements.loan_grade.value,
    loan_amnt: parseFloat(form.elements.loan_amnt.value),
    loan_int_rate: parseFloat(form.elements.loan_int_rate.value),
    loan_percent_income: parseFloat(form.elements.loan_percent_income.value),
    cb_person_default_on_file: form.elements.cb_person_default_on_file.value,
    cb_person_cred_hist_length: parseInt(form.elements.cb_person_cred_hist_length.value, 10),
  };

  setLoading(true);
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await apiError(res);
    const data = await res.json();
    // keep the "thinking" state visible long enough to read as deliberate
    const wait = Math.max(0, 700 - (performance.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    showResult(data, payload);
  } catch (err) {
    showError_(err);
  } finally {
    setLoading(false);
  }
});

async function apiError(res) {
  let detail = "";
  try {
    const j = await res.json();
    if (Array.isArray(j.detail)) detail = j.detail.map((d) => `${(d.loc || []).slice(-1)[0]}: ${d.msg}`).join("; ");
    else detail = j.detail || "";
  } catch (_) { /* ignore */ }
  const e = new Error(detail || `The server returned ${res.status}.`);
  e.status = res.status;
  return e;
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle("loading", on);
  $(".btn-label", submitBtn).textContent = on ? "Assessing" : "Assess risk";
  if (on) {
    markReady();
    panel.dataset.state = "loading";
    probNum.textContent = "…";
    badge.textContent = "Scoring application";
    explain.textContent = "Running the model.";
    facts.hidden = true;
    cutoff.setAttribute("opacity", "0");
    fillArc.style.strokeDashoffset = "100";
    needle.style.transform = "";
    needle.style.animation = "";
  }
}

function pct(x, d = 1) { return `${(x * 100).toFixed(d)}%`; }

function showResult(data, payload) {
  const p = Number(data.default_probability);
  const thr = Number(data.threshold);
  const high = Number(data.default_prediction) === 1;
  const state = high ? "high" : "low";

  needle.style.transition = reduceMotion ? "none" : "";
  needle.style.animation = "none";
  panel.dataset.state = state;
  setDial(p, thr);
  countTo(p * 100);

  badge.textContent = data.Result || (high ? "High Risk" : "Low Risk");
  badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");

  const gap = Math.abs(p - thr);
  explain.textContent = high
    ? `Default probability is ${pct(p)}, which is ${pct(gap)} above the ${pct(thr)} cutoff.`
    : `Default probability is ${pct(p)}, which is ${pct(gap)} below the ${pct(thr)} cutoff.`;

  $("#fProb").textContent = pct(p);
  $("#fThr").textContent = pct(thr);
  $("#fGap").textContent = `${high ? "+" : "−"}${pct(gap)}`;
  facts.hidden = false;

  addHistory(state, p, payload);

  if (window.matchMedia("(max-width: 960px)").matches) {
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

function showError_(err) {
  panel.dataset.state = "error";
  resetDial();
  probNum.textContent = "–";
  badge.textContent = "Couldn't get a result";
  const offline = err instanceof TypeError;
  explain.textContent = offline
    ? "The server didn't respond. If it was idle, wait about a minute for it to wake up and try again."
    : err.message;
  facts.hidden = true;
}

/* ---------- Session history ---------- */
function addHistory(state, p, d) {
  history.unshift({ state, p, label: `${d.loan_intent.toLowerCase().replace("homeimprovement", "home improvement").replace("debtconsolidation", "debt consolidation")} · grade ${d.loan_grade} · ${Number(d.loan_amnt).toLocaleString()}` });
  history.splice(4);
  const ul = $("#historyList");
  ul.innerHTML = "";
  history.forEach((h) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot ${h.state}"></span><span class="meta"></span><b>${(h.p * 100).toFixed(1)}%</b>`;
    $(".meta", li).textContent = h.label;
    ul.appendChild(li);
  });
  $("#history").hidden = false;
}

/* ---------- Reset & example ---------- */
form.addEventListener("reset", () => {
  setTimeout(() => {
    setGrade(""); setDefaultFlag("");
    pctTouched = false; autoBtn.hidden = true;
    $$(".field", form).forEach((f) => f.classList.remove("invalid"));
    panel.dataset.state = "idle";
    badge.textContent = "Awaiting application";
    explain.textContent = "Fill in the form and choose Assess risk. The result appears here.";
    probNum.textContent = "–";
    facts.hidden = true;
    needle.style.animation = "";
    resetDial();
  });
});

$("#fillExample").addEventListener("click", () => {
  const ex = {
    person_age: 27, person_income: 48000, person_home_ownership: "RENT", person_emp_length: 3,
    loan_intent: "EDUCATION", loan_amnt: 15000, loan_int_rate: 13.5, cb_person_cred_hist_length: 4,
  };
  Object.entries(ex).forEach(([k, v]) => { form.elements[k].value = v; clearError(form.elements[k]); });
  pctTouched = false; autoBtn.hidden = true; autoPct();
  setGrade("C"); setDefaultFlag("N");
  form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
});