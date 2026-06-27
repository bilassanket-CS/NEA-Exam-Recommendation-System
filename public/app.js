// public/app.js
// Vanilla-JS front end. Talks to the JSON API: gets a recommended question,
// submits the answer, shows feedback, and renders the analytics dashboard.

const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
};

let studentId = null;
let current = null; // current recommended question

// ---- bootstrap ----
init().catch((e) => alert("Startup error: " + e.message));

async function init() {
  // Reuse a student id from this browser, or create a fresh demo student.
  studentId = Number(localStorage.getItem("studentId")) || null;
  if (!studentId) {
    const { student } = await api.post("/api/students", { name: "Demo Student" });
    studentId = student.id;
    localStorage.setItem("studentId", String(studentId));
  }
  document.getElementById("student-label").textContent = `Student #${studentId}`;
  setupTabs();
  document.getElementById("submit-btn").addEventListener("click", submit);
  document.getElementById("skip-btn").addEventListener("click", loadQuestion);
  await loadQuestion();
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "dashboard") await loadDashboard();
    });
  });
}

// ---- practice ----
async function loadQuestion() {
  resetCard();
  const data = await api.get(`/api/recommendations?studentId=${studentId}&limit=1`);
  if (!data.questions.length) {
    document.getElementById("practice-empty").classList.remove("hidden");
    return;
  }
  current = data.questions[0];
  document.getElementById("question-card").classList.remove("hidden");
  document.getElementById("prompt").textContent = current.prompt;
  document.getElementById("reasons").innerHTML = current.reasons
    .map((r) => `<span>${escapeHtml(r)}</span>`)
    .join("");
  document.getElementById("rec-meta").textContent =
    `Recommended (score ${current.score}) \u00b7 ${current.marks} mark`;

  const opts = document.getElementById("options");
  opts.innerHTML = "";
  current.selected = null;
  current.options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = opt;
    b.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach((o) => o.classList.remove("selected"));
      b.classList.add("selected");
      current.selected = opt;
      document.getElementById("submit-btn").disabled = false;
    });
    opts.appendChild(b);
  });
}

async function submit() {
  if (!current || current.selected == null) return;
  const { result } = await api.post("/api/attempts", {
    studentId,
    questionId: current.questionId,
    answer: current.selected,
  });
  document.getElementById("submit-btn").disabled = true;

  document.querySelectorAll(".option").forEach((o) => {
    if (o.textContent === result.correctAnswer) o.classList.add("correct");
    else if (o.textContent === current.selected) o.classList.add("wrong");
  });

  const fb = document.getElementById("feedback");
  fb.classList.remove("hidden", "correct", "wrong");
  if (result.correct) {
    fb.classList.add("correct");
    fb.textContent = `Correct! Next review in ${result.intervalDays} day(s).`;
  } else {
    fb.classList.add("wrong");
    fb.textContent = `Not quite. Correct answer: ${result.correctAnswer}. This will come back for review soon.`;
  }
}

function resetCard() {
  document.getElementById("question-card").classList.add("hidden");
  document.getElementById("practice-empty").classList.add("hidden");
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("submit-btn").disabled = true;
}

// ---- dashboard ----
async function loadDashboard() {
  const data = await api.get(`/api/analytics?studentId=${studentId}`);
  document.getElementById("readiness").textContent = `${data.overallReadiness}%`;
  document.getElementById("due").textContent = data.dueCount;
  document.getElementById("rating").textContent = data.student.rating;

  const container = document.getElementById("topics");
  container.innerHTML = "";
  data.topics.forEach((t) => {
    const pct = Math.round(t.mastery * 100);
    const row = document.createElement("div");
    row.className = "topic-row";
    row.innerHTML = `
      <div class="topic-head">
        <span>${escapeHtml(t.topic)}</span>
        <span class="muted">${pct}% mastery \u00b7 ${t.correct}/${t.attempts} correct</span>
      </div>
      <div class="bar"><div style="width:${pct}%"></div></div>`;
    container.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}
