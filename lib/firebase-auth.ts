import { User } from "firebase/auth";
import { auth } from "./firebase";

export async function syncFirebaseSession(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/auth/firebase", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Could not create the manavOS session");
  }

  return data;
}

export async function signOutManavOS() {
  await fetch("/api/auth/signout", {
    method: "POST",
    credentials: "same-origin"
  });
  await auth.signOut();
}
