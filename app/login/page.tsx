"use client";

import { FormEvent, useEffect, useState } from "react";
import { Cloud, ArrowRight, Loader2 } from "lucide-react";
import "../globals.css";

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`The authentication server returned an unexpected response (HTTP ${response.status}).`);
  }
}

export default function LoginPage() {
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/auth/me",{credentials:"same-origin"}).then(readApiResponse).then(d=>{if(d.authenticated)location.href="/"}).catch(()=>{});},[]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch(`/api/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(mode==="signup"?{name,email,password}:{email,password})});const d=await readApiResponse(r);if(!r.ok)throw new Error(String(d.error||"Authentication failed"));location.href="/";}catch(err){setError(err instanceof Error?err.message:"Authentication failed");}finally{setBusy(false)}}
  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark">m</span><strong>manavOS</strong></div><div className="modal-icon"><Cloud size={23}/></div><p className="eyebrow">YOUR COMPUTER, ANYWHERE</p><h1>{mode==="signin"?"Welcome back":"Create your cloud computer"}</h1><p className="copy">{mode==="signin"?"Sign in to continue to your persistent cloud computer.":"Create your manavOS account. Your cloud workspace will be created automatically."}</p><form onSubmit={submit} className="auth-form">{mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required/>}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" autoComplete={mode==="signin"?"current-password":"new-password"} minLength={8} required/>{error&&<div className="auth-error">{error}</div>}<button className="primary auth-submit" disabled={busy}>{busy?<><Loader2 size={16} className="spin"/>Please wait…</>:<>{mode==="signin"?"Sign in":"Create account"}<ArrowRight size={16}/></>}</button></form><button className="switch-auth" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("")}}>{mode==="signin"?"New to manavOS? Create an account":"Already have an account? Sign in"}</button></div></main>
}
