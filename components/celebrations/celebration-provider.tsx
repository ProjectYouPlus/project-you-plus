"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { feedbackKind } from "@/lib/celebrations/client";
import { AchievementBadge } from "./achievement-badge";
import styles from "./celebrations.module.css";
import { DEFAULT_FEEDBACK_PREFERENCES, type CelebrationEvent, type FeedbackKind, type FeedbackPreferences } from "@/lib/celebrations/types";

const KEY="py_feedback_preferences";
const labels:Record<FeedbackKind,string>={task:"Task complete",habit:"Habit logged",workout:"Workout complete",day:"Day closed",achievement:"Achievement unlocked",milestone:"Milestone reached",one:"1% earned"};
export function CelebrationProvider(){
 const[prefs,setPrefs]=useState(DEFAULT_FEEDBACK_PREFERENCES);const[toast,setToast]=useState<string|null>(null);const[events,setEvents]=useState<CelebrationEvent[]>([]);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const checking=useRef(false);
 const read=useCallback(()=>{try{setPrefs({...DEFAULT_FEEDBACK_PREFERENCES,...JSON.parse(localStorage.getItem(KEY)||"{}")})}catch{}},[]);
 const check=useCallback(async()=>{if(checking.current)return;checking.current=true;try{const res=await fetch("/api/celebrations",{cache:"no-store"});if(res.ok){const body=await res.json();if(Array.isArray(body.events)&&body.events.length){setEvents(body.events);play(body.events[0].kind,prefs,true)}}}finally{checking.current=false}},[prefs]);
 useEffect(()=>{read();const setting=()=>read();window.addEventListener("storage",setting);window.addEventListener("py:feedback-settings",setting);return()=>{window.removeEventListener("storage",setting);window.removeEventListener("py:feedback-settings",setting)}},[read]);
 useEffect(()=>{const unlock=()=>{if(prefs.sound||prefs.celebrationSound)prepareAudio()};window.addEventListener("pointerdown",unlock,{passive:true});window.addEventListener("keydown",unlock);return()=>{window.removeEventListener("pointerdown",unlock);window.removeEventListener("keydown",unlock)}},[prefs.sound,prefs.celebrationSound]);
 useEffect(()=>{const handler=(raw:Event)=>{const kind=feedbackKind((raw as CustomEvent<unknown>).detail);if(!kind)return;setToast(labels[kind]);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(null),1700);play(kind,prefs,false);setTimeout(check,320)};window.addEventListener("py:feedback",handler);return()=>window.removeEventListener("py:feedback",handler)},[check,prefs]);
 useEffect(()=>{const id=setTimeout(check,650);return()=>clearTimeout(id)},[check]);
 const finish=async(skipped:boolean)=>{const ids=events.map(e=>e.eventId);setEvents([]);if(ids.length)await fetch("/api/celebrations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventIds:ids,skipped})})};
 const first=events[0];return <>{toast&&<div className={styles.toast} role="status"><i className={styles.toastDot}/>{toast}</div>}{first&&<div className={`${styles.backdrop} ${prefs.reducedMotion?styles.reduce:""}`} role="dialog" aria-modal="true" aria-label={first.title}><section className={styles.modal}><button className={styles.close} aria-label="Close celebration" onClick={()=>finish(true)}>×</button><div className={styles.content}><div className={styles.eyebrow}>{first.kind==="achievement"?"Achievement unlocked":first.kind==="one"?"The final standard":"Milestone reached"}</div><AchievementBadge achievementKey={first.key} level={first.level} size="large"/><h2 className={styles.title}>{first.title}</h2><p className={styles.copy}>{first.description}</p>{events.length>1&&<div className={styles.meta}>+{events.length-1} more earned</div>}<div className={styles.actions}><button className={styles.continue} onClick={()=>finish(false)}>Continue</button><button className={styles.skip} onClick={()=>finish(true)}>Skip celebration</button></div></div></section></div>}</>;
}
function play(kind:FeedbackKind,prefs:FeedbackPreferences,celebration:boolean){if((celebration?!prefs.celebrationSound:!prefs.sound)||typeof window==="undefined")return;if(prefs.haptics&&"vibrate"in navigator)navigator.vibrate(kind==="workout"||celebration?[22,30,34]:18);try{const ctx=prepareAudio();if(!ctx||ctx.state!=="running")return;const patterns:Record<FeedbackKind,number[]>={task:[440,660],habit:[392,523],workout:[330,494,659],day:[349,440,587],achievement:[523,659,784],milestone:[392,523,659,784],one:[330,494,659,988]};patterns[kind].forEach((frequency,index)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+index*.085;oscillator.type="sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.018);gain.gain.exponentialRampToValueAtTime(.001,start+.24);oscillator.connect(gain).connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.25)})}catch{}}

let sharedAudio: AudioContext | null = null;
function prepareAudio() {
  try {
    if (!sharedAudio || sharedAudio.state === "closed") sharedAudio = new window.AudioContext();
    if (sharedAudio.state === "suspended") void sharedAudio.resume().catch(() => undefined);
    return sharedAudio;
  } catch { return null; }
}
