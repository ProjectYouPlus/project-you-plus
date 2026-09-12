import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PATHS=["/login","/signup","/forgot-password","/reset-password"];
const ESSENTIAL_PATHS=["/privacy","/terms","/support","/help","/auth/confirm","/auth/callback","/auth/signout","/signout"];

export async function updateSession(request:NextRequest){
  let response=NextResponse.next({request});
  type CookieToSet={name:string;value:string;options?:Parameters<typeof response.cookies.set>[2]};
  const supabase=createServerClient(getSupabaseUrl(),getSupabasePublicKey(),{cookies:{getAll(){return request.cookies.getAll();},setAll(cookiesToSet:CookieToSet[]){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
  const {data:{user}}=await supabase.auth.getUser();
  const path=request.nextUrl.pathname;
  const isAuthPath=AUTH_PATHS.some(p=>path.startsWith(p));
  const isLanding=path==="/"||path==="/welcome";
  const isEssential=ESSENTIAL_PATHS.some(p=>path.startsWith(p));
  const isOnboarding=path.startsWith("/onboarding");
  const isOnboardingApi=path.startsWith("/api/onboarding");

  function redirectWithCookies(url:URL){const redirected=NextResponse.redirect(url);response.cookies.getAll().forEach(cookie=>redirected.cookies.set(cookie));return redirected;}

  if(!user&&!isAuthPath&&!isLanding&&!isEssential){
    if(path.startsWith("/api/"))return NextResponse.json({error:"Sign in to continue."},{status:401});
    const url=request.nextUrl.clone();url.pathname=isOnboarding?"/signup":"/login";return redirectWithCookies(url);
  }

  if(!user)return response;

  const {data:profile}=await supabase.from("profiles").select("onboarding_completed,onboarding_status").eq("id",user.id).maybeSingle();
  const onboardingComplete=profile?.onboarding_completed===true||profile?.onboarding_status==="completed";

  if(isAuthPath){const url=request.nextUrl.clone();url.pathname=onboardingComplete?"/today":"/onboarding";url.search="";return redirectWithCookies(url);}

  if(!onboardingComplete&&!isOnboarding&&!isOnboardingApi&&!isLanding&&!isEssential){
    if(path.startsWith("/api/"))return NextResponse.json({error:"Finish onboarding to use this feature.",code:"ONBOARDING_REQUIRED"},{status:409});
    const url=request.nextUrl.clone();url.pathname="/onboarding";url.search="";return redirectWithCookies(url);
  }

  return response;
}
