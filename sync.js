// sync.js — optional cross-device sync via the user's own free Firebase project.
// The app works fully offline without this; when configured, it layers on top:
// local writes happen instantly, then get mirrored to Firestore in the background,
// and a realtime listener pulls in changes made from other devices.

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { Store } from "./storage.js";

let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;
let unsubscribeSessions = null;
let unsubscribeTodos = null;

export const Sync = {
  isConfigured,
  currentUser: () => currentUser,

  async init({ onStatusChange }) {
    if (!isConfigured) {
      onStatusChange({ state: "offline-only", reason: "not-configured" });
      return;
    }
    try {
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);

      firebaseApp = initializeApp(firebaseConfig);
      auth = authMod.getAuth(firebaseApp);
      db = fsMod.getFirestore(firebaseApp);

      this._authMod = authMod;
      this._fsMod = fsMod;

      authMod.onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
          onStatusChange({ state: "synced", user });
          await this._mergeAndSubscribe(fsMod);
        } else {
          onStatusChange({ state: "offline-only" });
          if (unsubscribeSessions) unsubscribeSessions();
          if (unsubscribeTodos) unsubscribeTodos();
        }
      });
    } catch (err) {
      console.warn("Tide: Firebase failed to initialize, staying offline.", err);
      onStatusChange({ state: "offline-only", reason: "init-error" });
    }
  },

  async signIn() {
    if (!auth) return;
    const provider = new this._authMod.GoogleAuthProvider();
    await this._authMod.signInWithPopup(auth, provider);
  },

  async signOut() {
    if (!auth) return;
    await this._authMod.signOut(auth);
  },

  // --- pull remote + merge with local, then push local-only records up ---
  async _mergeAndSubscribe(fsMod) {
    const uidPath = currentUser.uid;

    await this._mergeCollection(fsMod, "sessions", uidPath, Store.getSessions, Store.replaceAll);
    await this._mergeCollection(fsMod, "todos", uidPath, Store.getTodos, Store.replaceAllTodos);

    // Live listeners: keep local storage in sync with remote changes from other devices.
    const sessionsRef = fsMod.collection(db, "users", uidPath, "sessions");
    unsubscribeSessions = fsMod.onSnapshot(sessionsRef, (snap) => {
      const remote = snap.docs.map((d) => d.data());
      Store.replaceAll(mergeByUpdatedAt(Store.getSessions(), remote));
    });

    const todosRef = fsMod.collection(db, "users", uidPath, "todos");
    unsubscribeTodos = fsMod.onSnapshot(todosRef, (snap) => {
      const remote = snap.docs.map((d) => d.data());
      Store.replaceAllTodos(mergeByUpdatedAt(Store.getTodos(), remote));
    });

    // Push any local record up (covers first sign-in with existing local data).
    document.addEventListener("tide:sessions-changed", () => this._pushAll("sessions", Store.getSessions()));
    document.addEventListener("tide:todos-changed", () => this._pushAll("todos", Store.getTodos()));
    this._pushAll("sessions", Store.getSessions());
    this._pushAll("todos", Store.getTodos());
  },

  async _mergeCollection(fsMod, name, uidPath, getLocal, setLocal) {
    const ref = fsMod.collection(db, "users", uidPath, name);
    const snap = await fsMod.getDocs(ref);
    const remote = snap.docs.map((d) => d.data());
    setLocal(mergeByUpdatedAt(getLocal(), remote));
  },

  async _pushAll(name, records) {
    if (!currentUser || !db) return;
    const fsMod = this._fsMod;
    for (const r of records) {
      const ref = fsMod.doc(db, "users", currentUser.uid, name, r.id);
      fsMod.setDoc(ref, r, { merge: true }).catch(() => {});
    }
  },
};

/** Last-write-wins merge keyed by id, comparing updatedAt timestamps. */
function mergeByUpdatedAt(localArr, remoteArr) {
  const byId = new Map();
  for (const item of localArr) byId.set(item.id, item);
  for (const item of remoteArr) {
    const existing = byId.get(item.id);
    if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}
