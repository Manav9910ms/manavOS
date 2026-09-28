const FIREBASE_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  "AIzaSyDDiB1BbwudTPt5WYay96q6_nSfiCatmRWs";

const LOOKUP_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
  encodeURIComponent(FIREBASE_API_KEY);

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Firebase ID token is required.");
  }

  const response = await fetch(LOOKUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || "Invalid Firebase ID token.";
    throw new Error(message);
  }

  const account = data?.users?.[0];
  if (!account?.localId) {
    throw new Error("Firebase account could not be verified.");
  }

  if (account.disabled) {
    throw new Error("This Firebase account is disabled.");
  }

  return {
    uid: account.localId,
    email: account.email || "",
    name: account.displayName || "",
    emailVerified: Boolean(account.emailVerified)
  };
}
