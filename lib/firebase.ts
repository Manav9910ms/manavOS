import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// This app is intentionally bound to the manav-os Firebase project.
// The web configuration is client-side configuration and is safe to ship
// with the web bundle. Keep Admin credentials off the client.
const firebaseConfig = {
  apiKey: "AIzaSyDDiB1BbwudTPt5WYay96q6_nSfiCatmRWs",
  authDomain: "manav-os.firebaseapp.com",
  projectId: "manav-os",
  storageBucket: "manav-os.firebasestorage.app",
  messagingSenderId: "228429674222",
  appId: "1:228429674222:web:b3f57e3eabf11000ae65ff",
  measurementId: "G-4SC3DRT1D3"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
