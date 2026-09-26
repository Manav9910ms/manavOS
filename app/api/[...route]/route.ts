import { NextRequest } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function proxy(req:NextRequest){
 const backend=process.env.MANAVOS_BACKEND_URL||"http://3.108.58.241:3000";
 const incoming=new URL(req.url);
 const target=new URL(incoming.pathname+incoming.search,backend);
 const headers=new Headers(req.headers);
 headers.delete("host"); headers.delete("origin"); headers.delete("content-length");
 const body=req.method==="GET"||req.method==="HEAD"?undefined:await req.arrayBuffer();
 try{
  const response=await fetch(target,{method:req.method,headers,body,redirect:"manual",cache:"no-store"});
  const out=new Headers(response.headers);
  out.set("Cache-Control","no-store");
  const cookie=response.headers.get("set-cookie");
  if(cookie)out.set("Set-Cookie",cookie);
  return new Response(response.body,{status:response.status,headers:out});
 }catch(error){
  return Response.json({error:"EC2 backbone unavailable: "+(error instanceof Error?error.message:"connection failed")},{status:502});
 }
}
export const GET=proxy; export const POST=proxy; export const PUT=proxy; export const PATCH=proxy; export const DELETE=proxy; export const OPTIONS=proxy;