// storage.js — local-first data layer.
// Everything reads/writes localStorage instantly. Firebase (sync.js) mirrors
// this in the background when the user signs in — the app never blocks on network.

const KEYS = {
  sessions: "tide.sessions",
  todos: "tide.todos",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readAll(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

export const Store = {
  // ---- Sessions ----
  getSessions() {
    return readAll(KEYS.sessions);
  },
  addSession({ startISO, durationMin, label, note, todoId }) {
    const sessions = readAll(KEYS.sessions);
    const record = {
      id: uid(),
      startISO,
      dateISO: startISO.slice(0, 10),
      durationMin,
      label: label || "",
      note: note || "",
      todoId: todoId || null,
      updatedAt: Date.now(),
    };
    sessions.push(record);
    writeAll(KEYS.sessions, sessions);
    document.dispatchEvent(new CustomEvent("tide:sessions-changed"));
    return record;
  },
  replaceAll(sessions) {
    writeAll(KEYS.sessions, sessions);
    document.dispatchEvent(new CustomEvent("tide:sessions-changed"));
  },

  // ---- Todos ----
  getTodos() {
    return readAll(KEYS.todos);
  },
  addTodo({ text, estMinutes }) {
    const todos = readAll(KEYS.todos);
    const record = {
      id: uid(),
      text,
      estMinutes: Number(estMinutes) || 25,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      suggestedSlots: [],
    };
    todos.push(record);
    writeAll(KEYS.todos, todos);
    document.dispatchEvent(new CustomEvent("tide:todos-changed"));
    return record;
  },
  updateTodo(id, patch) {
    const todos = readAll(KEYS.todos);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) return;
    todos[idx] = { ...todos[idx], ...patch, updatedAt: Date.now() };
    writeAll(KEYS.todos, todos);
    document.dispatchEvent(new CustomEvent("tide:todos-changed"));
  },
  deleteTodo(id) {
    const todos = readAll(KEYS.todos).filter((t) => t.id !== id);
    writeAll(KEYS.todos, todos);
    document.dispatchEvent(new CustomEvent("tide:todos-changed"));
  },
  replaceAllTodos(todos) {
    writeAll(KEYS.todos, todos);
    document.dispatchEvent(new CustomEvent("tide:todos-changed"));
  },
};

export { uid };
