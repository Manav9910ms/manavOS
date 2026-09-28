import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let cachedAuth = null;

function initAdmin() {
  if (cachedAuth) return cachedAuth;
  if (getApps().length) {
    cachedAuth = getAuth();
    return cachedAuth;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "manav-os";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n")
      })
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId
    });
  }

  cachedAuth = getAuth();
  return cachedAuth;
}

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Firebase ID token is required.");
  }

  return initAdmin().verifyIdToken(idToken);
}
