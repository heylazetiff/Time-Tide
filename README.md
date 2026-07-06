# Tide — a gentle pomodoro timer

A pomodoro timer for people who find most productivity apps stressful.

- Set a timer (or a custom length), and just start.
- When it ends, jot a line about what you actually did — or skip it, no guilt.
- **This week** shows a quiet bar chart of your focused time per day, plus every entry you logged.
- **To-dos** lets you list what's pending and get a suggested time slot for it — based on a free,
  local heuristic that looks at *your own* logged history (no API, no AI cost, nothing sent anywhere).
- Optional cross-device sync via your own free Firebase project.

Runs entirely as static files. No build step, no server, no paid tier required — hostable on
GitHub Pages forever, for free.

---

## 1. Run it locally first (optional but recommended)

Any static file server works, e.g. from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. It'll work fully offline — everything saves to
your browser's local storage.

## 2. Deploy to GitHub Pages (free, forever)

1. Create a new **public** GitHub repository (Pages' free tier requires public repos
   on a personal account — private repos need GitHub Pro, but public is completely free
   with no bandwidth/time limit for a project this size).
2. Push all these files to the repository root (or to a `/docs` folder — your choice).
3. In the repo: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**.
   Pick the `main` branch and the folder you used (`/` or `/docs`).
4. Save. GitHub will give you a URL like `https://yourname.github.io/your-repo/` within a minute or two.

That's it — the site is now live and free forever, with GitHub renewing hosting automatically.

## 3. Turn on cross-device sync (optional, also free)

Sync uses **Firebase's Spark plan** — Google's free tier, no credit card required. The limits
(1 GiB stored, 50k reads / 20k writes per day) are far beyond what a personal habit tracker needs.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → follow the prompts (you can decline Google Analytics, it's not needed).
2. Inside the project: **Build → Authentication → Get started → Sign-in method → enable "Google"**.
3. **Build → Firestore Database → Create database → Start in production mode** → pick any region close to you.
4. Still in Firestore, go to the **Rules** tab and replace the contents with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   This makes sure each signed-in user can only ever read or write their *own* data.
5. **Publish** the rules.
6. Back in **Project settings → General → Your apps → Add app → Web (`</>`)** → register the app
   (no need for Firebase Hosting) → copy the `firebaseConfig` object it gives you.
7. Open `firebase-config.js` in this project and paste your values in, replacing the placeholders.
8. Push the updated `firebase-config.js` to your GitHub repo (or keep it local-only if you don't
   want your Firebase project identifiers public — see note below).
9. Reload your deployed site → go to the **Sync** tab → **Sign in with Google**. Sign in with the
   same Google account on another device to see the same data there.

### A note on committing `firebase-config.js`

The values in `firebaseConfig` (API key, project ID, etc.) are not secret in the way a password
is — Google's own docs confirm they're safe to expose client-side. The Firestore **security rules**
in step 4 are what actually protect your data, not hiding these values. So it's fine to commit
`firebase-config.js` as-is to a public repo. If you'd still rather not, add it to `.gitignore` and
deploy it separately, or use GitHub's repository secrets with a small build step — but that adds
complexity this project intentionally avoids.

## How the time-slot suggestion works

`suggest.js` builds a simple weighted histogram of the day-of-week + hour your past focus sessions
actually started, giving more weight to recent weeks than old ones, with light smoothing into
neighbouring hours. When you ask it to suggest a time for a to-do, it proposes open slots in the
next 7 days that score highest against your own history — spread across different days rather than
stacked on one "best" hour. With fewer than 8 logged sessions, it falls back to gentle, generic
defaults (mid-morning, early evening) instead of pretending to know your rhythm yet. Everything runs
locally in the browser; no data leaves your device for this feature, and there's no API cost.

## File map

```
index.html                  — structure & all views (Timer / To-dos / Week / Sync)
style.css                   — design system (sage/honey palette, "tide" ring)
app.js                      — timer engine, view rendering, event wiring
storage.js                  — localStorage data layer
suggest.js                  — free local heuristic for time-slot suggestions
sync.js                     — optional Firebase Auth + Firestore sync
firebase-config.js          — your Firebase project keys (edit this)
firebase-config.example.js  — reference copy of the same template
```
