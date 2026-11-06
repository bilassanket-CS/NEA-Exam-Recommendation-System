// public/app.js
// Front end: token auth, adaptive practice (objective + written self-marking),
// analytics dashboard, and a teacher/admin panel for content/account management.

let token = localStorage.getItem("token") || null;
let currentUser = null;
let current = null; // current recommended question

const api = {
  async req(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  },
  get(p) { return this.req("GET", p); },
  post(p, b) { return this.req("POST", p, b); },
  put(p, b) { return this.req("PUT", p, b); },
};

init();

async function init() {
  applyTheme();
  wireLanding();
  wireAuth();
  if (token) {
    try { currentUser = (await api.get("/api/auth/me")).user; showApp(); }
    catch { token = null; localStorage.removeItem("token"); showLanding(); }
  } else showLanding();
}

// ---------- theme ----------
async function applyTheme() {
  try {
    const { effective, message } = await api.get("/api/theme");
    if (effective === "crimson") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", effective);
    localStorage.setItem("theme", effective);
    const bar = document.getElementById("seasonbar");
    if (message) {
      bar.innerHTML = `<b>${esc(effective.charAt(0).toUpperCase() + effective.slice(1))}</b> &nbsp; ${esc(message)}`;
      bar.classList.remove("hidden");
    } else {
      bar.classList.add("hidden");
    }
  } catch (e) { /* theme is cosmetic; a failed fetch just keeps the cached/default look */ }
}
const THEME_LABELS = {
  crimson: "Classic (Crimson and Black)", spring: "Spring", summer: "Summer", autumn: "Autumn",
  winter: "Winter", halloween: "Halloween", christmas: "Christmas",
};
async function loadThemeAdmin() {
  const { stored, effective } = await api.get("/api/theme");
  document.getElementById("theme-select").value = stored;
  document.getElementById("theme-status").textContent = stored === "auto"
    ? `Mode: Automatic. Today this shows the ${THEME_LABELS[effective] || effective} theme.`
    : `Current theme: ${THEME_LABELS[stored] || stored}.`;
}
async function applyThemeFromAdmin() {
  await api.put("/api/theme", { theme: val("theme-select") });
  await applyTheme();
  await loadThemeAdmin();
}

// ---------- landing ----------
function wireLanding() {
  document.getElementById("landing-nav-login").onclick = () => showAuth("login");
  document.getElementById("landing-hero-login").onclick = () => showAuth("login");
  document.getElementById("landing-hero-register").onclick = () => showAuth("register");
  document.getElementById("landing-final-register").onclick = () => showAuth("register");
}
function showLanding() {
  document.getElementById("landing").classList.add("active");
  document.getElementById("auth").classList.remove("active");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("site-header").classList.add("hidden");
}

// ---------- auth ----------
let registering = false;
function setAuthMode(isRegister) {
  registering = isRegister;
  document.getElementById("auth-title").textContent = registering ? "Create student account" : "Sign in";
  document.getElementById("auth-submit").textContent = registering ? "Create account" : "Sign in";
  document.getElementById("auth-toggle").textContent = registering ? "I already have an account" : "Create student account";
  document.getElementById("name-field").classList.toggle("hidden", !registering);
}
function wireAuth() {
  document.getElementById("auth-toggle").addEventListener("click", () => setAuthMode(!registering));
  document.getElementById("auth-submit").addEventListener("click", doAuth);
  document.getElementById("logout").addEventListener("click", logout);
}
async function doAuth() {
  const email = val("email"), password = val("password"), name = val("name");
  try {
    const path = registering ? "/api/auth/register" : "/api/auth/login";
    const data = await api.post(path, { email, password, name });
    token = data.token; currentUser = data.user;
    localStorage.setItem("token", token);
    showApp();
  } catch (e) { showAuthError(e.message); }
}
function logout() {
  token = null; currentUser = null; localStorage.removeItem("token");
  showLanding();
}
function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg; el.classList.remove("hidden");
}
function showAuth(mode) {
  if (mode === "login" || mode === "register") setAuthMode(mode === "register");
  document.getElementById("landing").classList.remove("active");
  document.getElementById("auth").classList.add("active");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("site-header").classList.remove("hidden");
}

// ---------- app shell ----------
function showApp() {
  document.getElementById("landing").classList.remove("active");
  document.getElementById("auth").classList.remove("active");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("site-header").classList.remove("hidden");
  document.getElementById("user-label").textContent = `${currentUser.name} (${currentUser.role})`;
  const staff = currentUser.role === "teacher" || currentUser.role === "admin";
  document.getElementById("tab-admin").classList.toggle("hidden", !staff);
  setupTabs();
  // students practise; staff land on admin
  if (staff) { activateTab("admin"); loadAdmin(); }
  else { activateTab("practice"); loadQuestion(); }
}
function setupTabs() {
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.onclick = async () => {
      activateTab(btn.dataset.tab);
      if (btn.dataset.tab === "dashboard") loadDashboard();
      if (btn.dataset.tab === "practice") loadQuestion();
      if (btn.dataset.tab === "admin") loadAdmin();
    };
  });
  document.getElementById("submit-btn").onclick = submit;
  document.getElementById("skip-btn").onclick = loadQuestion;
  document.getElementById("reveal-btn").onclick = revealMarkScheme;
  document.getElementById("add-question").onclick = addQuestion;
  document.getElementById("create-user").onclick = createUser;
  document.getElementById("q-type").onchange = toggleQuestionType;
  document.getElementById("apply-theme").onclick = applyThemeFromAdmin;
}
function activateTab(name) {
  document.querySelectorAll(".tab[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll("#app .panel").forEach((p) => p.classList.toggle("active", p.id === name));
}

// ---------- practice ----------
async function loadQuestion() {
  resetCard();
  const data = await api.get(`/api/recommendations?studentId=${currentUser.id}&limit=1`);
  if (!data.questions.length) { document.getElementById("practice-empty").classList.remove("hidden"); return; }
  current = data.questions[0];
  document.getElementById("question-card").classList.remove("hidden");
  document.getElementById("prompt").textContent = current.prompt;
  document.getElementById("reasons").innerHTML = current.reasons.map((r) => `<span>${esc(r)}</span>`).join("");
  document.getElementById("rec-meta").textContent =
    `Recommended (score ${current.score}) \u00b7 ${current.type} \u00b7 ${current.marks} mark(s)`;

  if (current.type === "written") {
    document.getElementById("written-answer").classList.remove("hidden");
    document.getElementById("reveal-btn").classList.remove("hidden");
    const a = document.getElementById("awarded"); a.max = current.marks;
  } else {
    const opts = document.getElementById("options");
    opts.innerHTML = ""; current.selected = null;
    current.options.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "option"; b.textContent = opt;
      b.onclick = () => {
        document.querySelectorAll(".option").forEach((o) => o.classList.remove("selected"));
        b.classList.add("selected"); current.selected = opt;
        document.getElementById("submit-btn").disabled = false;
      };
      opts.appendChild(b);
    });
  }
}
function revealMarkScheme() {
  // Mark scheme is only known after submitting; to keep answers server-side we
  // submit on reveal for written questions, then show the mark scheme + self-mark.
  document.getElementById("selfmark").classList.remove("hidden");
  document.getElementById("submit-btn").disabled = false;
  document.getElementById("reveal-btn").classList.add("hidden");
  document.getElementById("markscheme").textContent = "Award yourself marks honestly against the mark scheme shown after submitting.";
  document.getElementById("markscheme").classList.remove("hidden");
}
async function submit() {
  document.getElementById("submit-btn").disabled = true;
  let body = { studentId: currentUser.id, questionId: current.questionId };
  if (current.type === "written") {
    body.answer = document.getElementById("written-answer").value;
    body.selfMarks = Number(document.getElementById("awarded").value || 0);
  } else {
    if (current.selected == null) { document.getElementById("submit-btn").disabled = false; return; }
    body.answer = current.selected;
  }
  const { result } = await api.post("/api/attempts", body);

  const fb = document.getElementById("feedback");
  fb.classList.remove("hidden", "correct", "wrong");
  if (current.type === "written") {
    document.getElementById("markscheme").textContent = "Mark scheme: " + result.markScheme;
    fb.classList.add(result.correct ? "correct" : "wrong");
    fb.textContent = `You awarded ${result.awardedMarks}/${result.maxMarks}. Next review in ${result.intervalDays} day(s).`;
  } else {
    document.querySelectorAll(".option").forEach((o) => {
      if (o.textContent === result.correctAnswer) o.classList.add("correct");
      else if (o.textContent === current.selected) o.classList.add("wrong");
    });
    fb.classList.add(result.correct ? "correct" : "wrong");
    fb.textContent = result.correct
      ? `Correct! Next review in ${result.intervalDays} day(s).`
      : `Not quite. Correct answer: ${result.correctAnswer}.`;
  }
}
function resetCard() {
  ["question-card", "practice-empty", "feedback", "written-answer", "markscheme", "selfmark"].forEach((id) =>
    document.getElementById(id).classList.add("hidden"));
  document.getElementById("reveal-btn").classList.add("hidden");
  document.getElementById("submit-btn").disabled = true;
  document.getElementById("written-answer").value = "";
}

// ---------- dashboard ----------
async function loadDashboard() {
  const data = await api.get(`/api/analytics?studentId=${currentUser.id}`);
  document.getElementById("readiness").textContent = `${data.overallReadiness}%`;
  document.getElementById("due").textContent = data.dueCount;
  document.getElementById("rating").textContent = data.student.rating;
  const c = document.getElementById("topics"); c.innerHTML = "";
  data.topics.forEach((t) => {
    const pct = Math.round(t.mastery * 100);
    const row = document.createElement("div"); row.className = "topic-row";
    row.innerHTML = `<div class="topic-head"><span>${esc(t.topic)}</span>
      <span class="muted">${pct}% mastery \u00b7 ${t.correct}/${t.attempts} correct</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>`;
    c.appendChild(row);
  });
}

// ---------- admin ----------
function toggleQuestionType() {
  const written = document.getElementById("q-type").value === "written";
  document.getElementById("objective-fields").classList.toggle("hidden", written);
  document.getElementById("written-fields").classList.toggle("hidden", !written);
}
async function loadAdmin() {
  const { topics } = await api.get("/api/topics");
  document.getElementById("q-topic").innerHTML = topics.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  // account management is admin-only
  const adminOnly = currentUser.role === "admin";
  document.getElementById("users-heading").classList.toggle("hidden", !adminOnly);
  document.getElementById("users").classList.toggle("hidden", !adminOnly);
  document.getElementById("create-user-card").classList.toggle("hidden", !adminOnly);
  document.getElementById("theme-heading").classList.toggle("hidden", !adminOnly);
  document.getElementById("theme-card").classList.toggle("hidden", !adminOnly);
  if (adminOnly) { loadUsers(); loadThemeAdmin(); }
}
async function addQuestion() {
  const type = document.getElementById("q-type").value;
  const body = {
    topicId: Number(val("q-topic")), subTopic: val("q-sub"), type,
    prompt: val("q-prompt"), marks: Number(val("q-marks")) || 1,
  };
  if (type === "objective") {
    body.options = val("q-options").split(",").map((s) => s.trim()).filter(Boolean);
    body.answer = val("q-answer");
  } else {
    body.markScheme = val("q-markscheme");
  }
  const msg = document.getElementById("admin-msg");
  msg.classList.remove("hidden", "correct", "wrong");
  try {
    await api.post("/api/questions", body);
    msg.classList.add("correct"); msg.textContent = "Question added.";
    ["q-prompt", "q-options", "q-answer", "q-sub", "q-markscheme"].forEach((id) => { const e = document.getElementById(id); if (e) e.value = ""; });
  } catch (e) { msg.classList.add("wrong"); msg.textContent = e.message; }
}
async function loadUsers() {
  const { users } = await api.get("/api/users");
  const rows = users.map((u) => `<tr class="${u.active ? "" : "inactive"}">
    <td>${esc(u.name)}</td><td>${esc(u.email || "")}</td><td><span class="badge">${u.role}</span></td>
    <td>${u.active ? "active" : "disabled"}</td>
    <td><button data-id="${u.id}" data-act="${u.active ? "disable" : "enable"}">${u.active ? "Disable" : "Enable"}</button></td></tr>`).join("");
  document.getElementById("users").innerHTML =
    `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  document.querySelectorAll("#users button").forEach((b) => {
    b.onclick = async () => { await api.post(`/api/users/${b.dataset.id}/${b.dataset.act}`); loadUsers(); };
  });
}
async function createUser() {
  try {
    await api.post("/api/users", { name: val("u-name"), email: val("u-email"), password: val("u-pass"), role: val("u-role") });
    ["u-name", "u-email", "u-pass"].forEach((id) => document.getElementById(id).value = "");
    loadUsers();
  } catch (e) { alert(e.message); }
}

// ---------- helpers ----------
function val(id) { return document.getElementById(id).value.trim(); }
function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
