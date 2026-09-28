"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from "firebase/auth";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { syncFirebaseSession } from "@/lib/firebase-auth";

type Mode = "signin" | "signup";

function friendlyError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";

  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/weak-password": "Use a stronger password. Firebase requires at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in popup.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase yet."
  };

  return messages[code] || (error instanceof Error ? error.message : "Authentication failed.");
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finish = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Firebase did not create a user session.");
    await syncFirebaseSession(user);
    router.replace("/");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      await finish();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await finish();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />

      <a className="auth-back" href="/">
        <ArrowLeft size={15} />
        Back to manavOS
      </a>

      <section className="auth-card">
        <div className="auth-brand">
          <span>m</span>
          <div>
            <strong>manavOS</strong>
            <small>your computer, anywhere</small>
          </div>
        </div>

        <div className="auth-intro">
          <div className="auth-icon"><ShieldCheck size={21} /></div>
          <span className="kicker">CLOUD ACCOUNT</span>
          <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p>
            {mode === "signup"
              ? "Save your workspace and keep your cloud computer tied to your account."
              : "Sign in to continue to your persistent cloud workspace."}
          </p>
        </div>

        <div className="auth-tabs">
          <button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>
            Sign in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            <span>Email</span>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input
                required
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="auth-input-wrap">
              <input
                required
                minLength={6}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={17} /> : null}
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="google-button" type="button" onClick={google} disabled={busy}>
          <span className="google-letter">G</span>
          Continue with Google
        </button>

        <p className="auth-note">
          You can continue using manavOS as a guest. An account makes your workspace persistent and available after signing in again.
        </p>
      </section>
    </main>
  );
}
