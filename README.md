# Tide — a gentle pomodoro timer

A pomodoro timer for people who find most productivity apps stressful.

- Set a timer (or a custom length), and just start.
- When it ends, jot a line about what you actually did — or skip it, no guilt.
- **This week** shows a quiet bar chart of your focused time per day, plus every entry you logged.
- **To-dos** lets you list what's pending and get a suggested time slot for it — based on a free,
  local heuristic that looks at *your own* logged history (no API, no AI cost, nothing sent anywhere).
- Optional cross-device sync via your own free Firebase project.

**Everything lives in one file: `index.html`.** No build step, no folder structure to get wrong,
no server required — just this one file, hostable on GitHub Pages forever, for free.

---

## 1. Try it locally first (optional)

Just double-click `index.html` to open it in a browser, or serve it with any static file server.
It works fully offline — everything saves to your browser's local storage.

## 2. Deploy to GitHub Pages (free, forever)

1. Create a new **public** GitHub repository (Pages' free tier requires public repos on a personal
   account — private repos need GitHub Pro, but public is completely free with no time limit).
2. **Add file → Upload files** → drag in this single `index.html` → commit.
3. **Settings → Pages → Build and deployment → Source: "Deploy from a branch"** → pick `main` and `/ (root)`.
4. Save. GitHub gives you a URL like `https://yourname.github.io/your-repo/` within a minute or two.

Because it's one file, there's no way for pieces to end up in the wrong folder — whatever you
upload is exactly what the browser loads.

## 3. Turn on cross-device sync (optional, also free)

Sync uses **Firebase's Spark plan** — Google's free tier, no credit card required. The limits
(1 GiB stored, 50k reads / 20k writes per day) are far beyond what a personal habit tracker needs.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (you can decline Google Analytics).
2. **Build → Authentication → Get started → Sign-in method → enable "Google"**.
3. **Build → Firestore Database → Create database → Start in production mode** → pick any nearby region.
4. In Firestore's **Rules** tab, replace the contents with:

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

   This makes sure each signed-in user can only ever read or write their *own* data. **Publish** it.
5. **Project settings → General → Your apps → Add app → Web (`</>`)** → register (skip Firebase Hosting) → copy the `firebaseConfig` object shown.
6. Open `index.html` in a text editor, find the block near the top of the `<script>` section that starts with:

   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     ...
   ```

   and replace the placeholder values with your own.
7. Re-upload the edited `index.html` to your GitHub repo (same steps as above — it'll overwrite the old one).
8. Reload your deployed site → **Sync** tab → **Sign in with Google**. Sign in with the same account
   on another device to see the same data there.

### A note on these config values

The `firebaseConfig` values (API key, project ID, etc.) aren't secret the way a password is —
Google's own docs confirm they're safe to expose client-side. The Firestore **security rules** in
step 4 are what actually protect your data, not hiding these values, so it's fine that they sit in
plain sight inside `index.html`.

## How the time-slot suggestion works

The app builds a simple weighted histogram of the day-of-week + hour your past focus sessions
actually started, giving more weight to recent weeks than old ones, with light smoothing into
neighbouring hours. When you ask it to suggest a time for a to-do, it proposes open slots in the
next 7 days that score highest against your own history — spread across different days rather than
stacked on one "best" hour. With fewer than 8 logged sessions, it falls back to gentle, generic
defaults (mid-morning, early evening) instead of pretending to know your rhythm yet. Everything runs
locally in the browser; no data leaves your device for this feature, and there's no API cost.

