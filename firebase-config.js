// firebase-config.js — edit this file directly with your own free Firebase project's values.
//
// 1. Go to https://console.firebase.google.com → create a free project.
// 2. Project settings → General → scroll to "Your apps" → add a Web app → copy the config below.
// 3. In the Firebase console: Authentication → Sign-in method → enable "Google".
// 4. In the Firebase console: Firestore Database → Create database → start in production mode.
// 5. Paste your own values in below and save. Reload the site — sync will turn on automatically.
// See README.md for the full walkthrough and the Firestore security rules to paste in.

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
