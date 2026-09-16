import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = String(process.env.MANAVOS_BACKEND_URL || "").replace(/\/+$/, "");
const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "cookie", "if-match", "if-none-match", "x-csrf-token"];
const FORWARD_RESPONSE_HEADERS = ["cache-control", "content-disposition", "content-length", "content-type", "location", "retry-after"];

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function copyResponseHeaders(source: Response) {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = source.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Preserve the backend's session cookie so auth remains same-origin from the browser's point of view.
  const getSetCookie = (source.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const cookie of getSetCookie.call(source.headers)) headers.append("set-cookie", cookie);
  } else {
    const cookie = source.headers.get("set-cookie");
    if (cookie) headers.set("set-cookie", cookie);
  }

  return headers;
}

export async function GET(request: NextRequest) { return proxy(request); }
export async function POST(request: NextRequest) { return proxy(request); }
export async function PUT(request: NextRequest) { return proxy(request); }
export async function PATCH(request: NextRequest) { return proxy(request); }
export async function DELETE(request: NextRequest) { return proxy(request); }

async function proxy(request: NextRequest) {
  if (!BACKEND_URL) {
    return jsonError(503, "manavOS backend is not configured. Set MANAVOS_BACKEND_URL in the deployment environment.");
  }

  const incomingUrl = new URL(request.url);
  const target = `${BACKEND_URL}${incomingUrl.pathname}${incomingUrl.search}`;
  const headers = new Headers();

  // Do not forward Origin: the browser is calling the same-origin Vercel endpoint and
  // the backend request itself is server-to-server. This avoids a false CSRF/origin mismatch.
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  let body: ArrayBuffer | undefined;
  if (!METHODS_WITHOUT_BODY.has(request.method)) {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backend error";
    return jsonError(502, `manavOS backend is unreachable: ${message}`);
  }
}
