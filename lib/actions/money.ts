"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPES=new Set(["checking","savings","credit","investment","cash","other"]);
export async function addFinanceAccount(formData:FormData){ const name=String(formData.get("name")??"").trim(); const accountType=String(formData.get("accountType")??"other"); const balance=Number(formData.get("balance")); if(!name)return{error:"Name the account."}; if(!TYPES.has(accountType))return{error:"Choose a valid account type."}; if(!Number.isFinite(balance))return{error:"Enter a valid balance."}; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return{error:"Sign in again to save financial data."}; const {error}=await supabase.from("finance_accounts").insert({user_id:user.id,name,account_type:accountType,balance,connected_via:"manual"}); if(error)return{error:error.message}; revalidatePath("/money");revalidatePath("/today");revalidatePath("/you"); return{error:null}; }
