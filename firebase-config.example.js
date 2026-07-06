// firebase-config.js
//
// 1. Copy this file to "firebase-config.js" (that exact name — it's the one app.js loads).
// 2. Go to https://console.firebase.google.com → create a free project.
// 3. Project settings → General → scroll to "Your apps" → add a Web app → copy the config below.
// 4. In the Firebase console: Authentication → Sign-in method → enable "Google".
// 5. In the Firebase console: Firestore Database → Create database → start in production mode.
// 6. Paste your own values in below. Never commit real keys to a public repo's
//    firebase-config.js if you'd rather keep them private — Firestore security
//    rules (see README.md) are what actually protects your data, not secrecy of this config.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Leave this as-is — app.js uses it to detect whether you've filled in real values yet.
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";
