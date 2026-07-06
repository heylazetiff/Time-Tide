import { Store } from "./storage.js";
import { suggestSlots } from "./suggest.js";
import { Sync } from "./sync.js";

/* ---------------------------------------------------------------
   Tabs
--------------------------------------------------------------- */
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
    views.forEach((v) => v.classList.remove("is-active"));
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(`view-${tab.dataset.view}`).classList.add("is-active");
    if (tab.dataset.view === "todos") renderTodos();
    if (tab.dataset.view === "week") renderWeek();
  });
});

/* ---------------------------------------------------------------
   Timer engine
--------------------------------------------------------------- */
const RING_CIRCUMFERENCE = 2 * Math.PI * 104; // matches r=104 in SVG

const durationRow = document.getElementById("durationRow");
const customChip = document.getElementById("customChip");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const timeReadout = document.getElementById("timeReadout");
const timeCaption = document.getElementById("timeCaption");
const timerHint = document.getElementById("timerHint");
const ringFill = document.getElementById("ringFill");
const tideRect = document.getElementById("tideRect");
const attachTodo = document.getElementById("attachTodo");

let selectedMinutes = 25;
let totalSeconds = selectedMinutes * 60;
let remainingSeconds = totalSeconds;
let tickHandle = null;
let isRunning = false;
let isPaused = false;
let startedAtISO = null;

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setDuration(mins) {
  selectedMinutes = mins;
  totalSeconds = mins * 60;
  remainingSeconds = totalSeconds;
  timeReadout.textContent = formatTime(remainingSeconds);
  updateRing();
  [...durationRow.querySelectorAll(".chip")].forEach((c) => c.classList.remove("is-selected"));
  const match = [...durationRow.querySelectorAll(".chip")].find((c) => Number(c.dataset.mins) === mins);
  if (match) match.classList.add("is-selected");
}

durationRow.querySelectorAll(".chip[data-mins]").forEach((chip) => {
  chip.addEventListener("click", () => { if (!isRunning) setDuration(Number(chip.dataset.mins)); });
});

customChip.addEventListener("click", () => {
  if (isRunning) return;
  const val = prompt("Custom length in minutes:", selectedMinutes);
  const n = parseInt(val, 10);
  if (n && n > 0 && n <= 240) setDuration(n);
});

function updateRing() {
  const progress = 1 - remainingSeconds / totalSeconds; // 0 -> 1 as time passes
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  ringFill.setAttribute("stroke-dasharray", RING_CIRCUMFERENCE);
  ringFill.setAttribute("stroke-dashoffset", offset);

  // Tide rect: rect starts at y=240 (fully below the circle, i.e. empty)
  // and rises to y = 240 - 240*progress as time fills up.
  const y = 240 - 240 * progress;
  tideRect.setAttribute("y", y);
}

function tick() {
  remainingSeconds -= 1;
  timeReadout.textContent = formatTime(Math.max(0, remainingSeconds));
  updateRing();
  if (remainingSeconds <= 0) {
    finishSession(true);
  }
}

startBtn.addEventListener("click", () => {
  if (isPaused) {
    isPaused = false;
    isRunning = true;
    tickHandle = setInterval(tick, 1000);
    startBtn.classList.add("is-hidden");
    pauseBtn.classList.remove("is-hidden");
    timeCaption.textContent = "gathering time…";
    return;
  }
  startedAtISO = new Date().toISOString();
  isRunning = true;
  startBtn.classList.add("is-hidden");
  pauseBtn.classList.remove("is-hidden");
  stopBtn.classList.remove("is-hidden");
  durationRow.querySelectorAll(".chip").forEach((c) => (c.disabled = true));
  attachTodo.disabled = true;
  timeCaption.textContent = "gathering time…";
  timerHint.textContent = "You can pause any time — this isn't a race.";
  tickHandle = setInterval(tick, 1000);
});

pauseBtn.addEventListener("click", () => {
  isPaused = true;
  isRunning = false;
  clearInterval(tickHandle);
  startBtn.classList.remove("is-hidden");
  startBtn.textContent = "Resume";
  pauseBtn.classList.add("is-hidden");
  timeCaption.textContent = "paused — whenever you're ready";
});

stopBtn.addEventListener("click", () => {
  if (confirm("End this session early? What you've focused so far will still be saved.")) {
    finishSession(false);
  }
});

function finishSession(completedFully) {
  clearInterval(tickHandle);
  isRunning = false;
  isPaused = false;
  const elapsedSeconds = totalSeconds - Math.max(0, remainingSeconds);
  const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

  startBtn.classList.remove("is-hidden");
  startBtn.textContent = "Start";
  pauseBtn.classList.add("is-hidden");
  stopBtn.classList.add("is-hidden");
  durationRow.querySelectorAll(".chip").forEach((c) => (c.disabled = false));
  attachTodo.disabled = false;
  timeCaption.textContent = "ready when you are";
  timerHint.textContent = "Pick a length, or just start — there's no wrong way to begin.";

  pendingSession = {
    startISO: startedAtISO || new Date().toISOString(),
    durationMin: elapsedMinutes,
    todoId: attachTodo.value || null,
    label: attachTodo.value ? (attachTodo.options[attachTodo.selectedIndex].text) : "",
  };
  openLogModal();

  setDuration(selectedMinutes); // reset ring for next round
}

setDuration(25);

/* ---------------------------------------------------------------
   Log modal
--------------------------------------------------------------- */
const logModal = document.getElementById("logModal");
const logNote = document.getElementById("logNote");
let pendingSession = null;

function openLogModal() {
  logNote.value = "";
  logModal.classList.remove("is-hidden");
  logNote.focus();
}
function closeLogModal() {
  logModal.classList.add("is-hidden");
}

document.getElementById("skipLog").addEventListener("click", () => {
  if (pendingSession) Store.addSession({ ...pendingSession, note: "" });
  pendingSession = null;
  closeLogModal();
});

document.getElementById("saveLog").addEventListener("click", () => {
  if (pendingSession) Store.addSession({ ...pendingSession, note: logNote.value.trim() });
  pendingSession = null;
  closeLogModal();
});

/* ---------------------------------------------------------------
   Todos
--------------------------------------------------------------- */
const todoForm = document.getElementById("todoForm");
const todoTextInput = document.getElementById("todoText");
const todoMinsInput = document.getElementById("todoMins");
const todoListEl = document.getElementById("todoList");

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoTextInput.value.trim();
  if (!text) return;
  Store.addTodo({ text, estMinutes: todoMinsInput.value });
  todoTextInput.value = "";
  todoMinsInput.value = 25;
  renderTodos();
  refreshTodoAttachOptions();
});

function renderTodos() {
  const todos = Store.getTodos().slice().sort((a, b) => a.done - b.done || b.createdAt - a.createdAt);
  todoListEl.innerHTML = "";
  if (todos.length === 0) {
    todoListEl.innerHTML = `<li class="empty-note">Nothing on the list yet. Add something small — it counts.</li>`;
    return;
  }
  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " is-done" : "");
    li.innerHTML = `
      <div class="todo-row">
        <button class="todo-check" aria-label="Mark done"></button>
        <span class="todo-text">${escapeHTML(todo.text)}</span>
        <span class="todo-meta">${todo.estMinutes} min</span>
        <div class="todo-actions">
          <button class="btn-suggest">Suggest a time</button>
          <button class="btn-delete">Remove</button>
        </div>
      </div>
      <div class="suggestions-mount"></div>
    `;
    li.querySelector(".todo-check").addEventListener("click", () => {
      Store.updateTodo(todo.id, { done: !todo.done });
      renderTodos();
      refreshTodoAttachOptions();
    });
    li.querySelector(".btn-delete").addEventListener("click", () => {
      Store.deleteTodo(todo.id);
      renderTodos();
      refreshTodoAttachOptions();
    });
    li.querySelector(".btn-suggest").addEventListener("click", () => {
      renderSuggestions(li, todo);
    });

    if (todo.suggestedSlots && todo.suggestedSlots.length) {
      renderSuggestions(li, todo, true);
    }

    todoListEl.appendChild(li);
  }
}

function renderSuggestions(li, todo, silentReuse) {
  const mount = li.querySelector(".suggestions-mount");
  const result = silentReuse && todo.suggestedSlots.length
    ? { slots: todo.suggestedSlots, confident: true }
    : suggestSlots(Store.getSessions(), Store.getTodos(), todo.estMinutes);

  if (!silentReuse) {
    Store.updateTodo(todo.id, { suggestedSlots: result.slots });
  }

  const note = result.confident
    ? "Based on when you've actually focused before:"
    : "Not much history yet, so these are gentle general defaults:";

  mount.innerHTML = `
    <div class="suggestions">
      <div class="suggestion-note">${note}</div>
      ${result.slots.map((s) => `<button class="suggestion-slot" data-date="${s.dateISO}" data-hour="${s.hour}">${s.label}</button>`).join("")}
    </div>
  `;

  mount.querySelectorAll(".suggestion-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.textContent = `Planned for ${btn.textContent}`;
      btn.disabled = true;
    });
  });
}

function refreshTodoAttachOptions() {
  const todos = Store.getTodos().filter((t) => !t.done);
  attachTodo.innerHTML = `<option value="">Just want to focus — no specific task</option>`;
  for (const t of todos) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.text;
    attachTodo.appendChild(opt);
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("tide:todos-changed", refreshTodoAttachOptions);
document.addEventListener("tide:sessions-changed", () => {
  if (document.getElementById("view-week").classList.contains("is-active")) renderWeek();
});

/* ---------------------------------------------------------------
   Week review
--------------------------------------------------------------- */
const weekChart = document.getElementById("weekChart");
const weekTotal = document.getElementById("weekTotal");
const dayLog = document.getElementById("dayLog");

function renderWeek() {
  const sessions = Store.getSessions();
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const byDate = {};
  for (const s of sessions) {
    byDate[s.dateISO] = byDate[s.dateISO] || [];
    byDate[s.dateISO].push(s);
  }

  const maxMinutes = Math.max(
    60,
    ...days.map((d) => sumMinutes(byDate[isoOf(d)] || []))
  );

  weekChart.innerHTML = "";
  let weekMinutes = 0;
  for (const d of days) {
    const iso = isoOf(d);
    const mins = sumMinutes(byDate[iso] || []);
    weekMinutes += mins;
    const heightPct = Math.max(4, (mins / maxMinutes) * 100);
    const isToday = iso === isoOf(today);
    const wrap = document.createElement("div");
    wrap.className = "week-bar-wrap";
    wrap.innerHTML = `
      <div class="week-bar-value">${mins ? mins + "m" : ""}</div>
      <div class="week-bar${isToday ? " is-today" : ""}" style="height:${heightPct}%"></div>
      <div class="week-bar-label">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
    `;
    weekChart.appendChild(wrap);
  }

  const h = Math.floor(weekMinutes / 60);
  const m = weekMinutes % 60;
  weekTotal.innerHTML = `<strong>${h}h ${m}m</strong> focused this week — however that happened.`;

  dayLog.innerHTML = "";
  for (const d of [...days].reverse()) {
    const iso = isoOf(d);
    const list = (byDate[iso] || []).slice().sort((a, b) => a.startISO.localeCompare(b.startISO));
    const group = document.createElement("div");
    group.className = "day-group";
    group.innerHTML = `<h4>${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h4>`;
    if (list.length === 0) {
      group.innerHTML += `<div class="empty-note">Nothing logged.</div>`;
    } else {
      for (const s of list) {
        const row = document.createElement("div");
        row.className = "session-row";
        const label = s.label || s.note || "Focused time";
        row.innerHTML = `<span class="session-note">${escapeHTML(label)}</span><span class="session-dur">${s.durationMin}m</span>`;
        group.appendChild(row);
      }
    }
    dayLog.appendChild(group);
  }
}

function sumMinutes(list) { return list.reduce((sum, s) => sum + s.durationMin, 0); }
function isoOf(d) { return d.toISOString().slice(0, 10); }

/* ---------------------------------------------------------------
   Sync / settings
--------------------------------------------------------------- */
const syncIndicator = document.getElementById("syncIndicator");
const syncLabel = syncIndicator.querySelector(".sync-label");
const googleSignIn = document.getElementById("googleSignIn");
const firebaseStatus = document.getElementById("firebaseStatus");

Sync.init({
  onStatusChange: ({ state, reason, user }) => {
    if (state === "synced") {
      syncIndicator.classList.add("is-synced");
      syncLabel.textContent = `Synced as ${user.displayName || user.email}`;
      googleSignIn.textContent = "Sign out";
      firebaseStatus.textContent = "";
    } else {
      syncIndicator.classList.remove("is-synced");
      syncLabel.textContent = "Saved on this device";
      googleSignIn.textContent = "Sign in with Google";
      if (reason === "not-configured") {
        firebaseStatus.textContent = "Sync isn't set up yet — edit firebase-config.js to enable it (see README).";
        googleSignIn.disabled = true;
      } else if (reason === "init-error") {
        firebaseStatus.textContent = "Couldn't reach Firebase — check your config values and internet connection.";
      }
    }
  },
});

googleSignIn.addEventListener("click", async () => {
  if (Sync.currentUser()) {
    await Sync.signOut();
  } else {
    try {
      await Sync.signIn();
    } catch (err) {
      firebaseStatus.textContent = "Sign-in didn't go through. Double check firebase-config.js and that Google sign-in is enabled in your Firebase project.";
    }
  }
});

/* ---------------------------------------------------------------
   Initial render
--------------------------------------------------------------- */
refreshTodoAttachOptions();
renderTodos();
