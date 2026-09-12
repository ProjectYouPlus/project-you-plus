"use client";
import { emitFeedback } from "@/lib/celebrations/client";
export function DayCloseButton(){return <button className="py-liquid-button min-h-12 w-full" type="submit" onClick={()=>emitFeedback("day")}>Close today</button>}
