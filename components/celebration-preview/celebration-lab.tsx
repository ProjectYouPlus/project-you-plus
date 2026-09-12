"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./celebration-lab.module.css";

type EventKind = "task" | "habit" | "workout" | "day" | "achievement" | "milestone" | "one";
type PreviewEvent = { id: string; title: string; copy: string; kind: EventKind; duration: string; intensity: string; trigger: string; level?: number };

const microEvents: PreviewEvent[] = [
  { id: "task", title: "Task complete", copy: "A precise tactile close — immediate, quiet, final.", kind: "task", duration: "220 ms", intensity: "Low", trigger: "Task checked" },
  { id: "habit", title: "Habit complete", copy: "A warmer response that signals another vote for consistency.", kind: "habit", duration: "340 ms", intensity: "Low", trigger: "Habit logged" },
  { id: "workout", title: "Workout complete", copy: "A controlled lift and resolve with more physical weight.", kind: "workout", duration: "780 ms", intensity: "Medium", trigger: "Workout finished" },
  { id: "day", title: "Day closed", copy: "A low closing tone followed by a clean, resolved horizon.", kind: "day", duration: "1.1 sec", intensity: "Medium", trigger: "Daily close" },
];

const achievements: PreviewEvent[] = [
  ["first-day", "First Day Completed", "The first loop is closed."], ["full-week", "First Full Week", "Seven days, completed with intent."],
  ["consistency", "7-Day Consistency", "Seven days of showing up."], ["goal", "First Goal Completed", "A promise became proof."],
  ["workout-week", "3/3 Workout Week", "The plan was completed."], ["review", "First Weekly Review", "You looked back to move forward."],
  ["budget", "Budget Month Completed", "The month closed with control."], ["discipline", "30-Day Discipline", "Consistency became a standard."],
].map(([id, title, copy]) => ({ id, title, copy, kind: "achievement" as const, duration: "1.8 sec", intensity: "Elevated", trigger: "Evidence-backed unlock" }));

const milestones: PreviewEvent[] = [
  { id: "foundation", title: "Foundation", copy: "You’ve built the base.", kind: "milestone", level: 60, duration: "3.5 sec", intensity: "Cinematic", trigger: "Sustained level reached" },
  { id: "momentum", title: "Momentum", copy: "You’re no longer starting from zero.", kind: "milestone", level: 70, duration: "4 sec", intensity: "Cinematic", trigger: "Sustained level reached" },
  { id: "alignment", title: "Alignment", copy: "More of your life is working together.", kind: "milestone", level: 80, duration: "4 sec", intensity: "Cinematic", trigger: "Sustained level reached" },
  { id: "elite", title: "Elite", copy: "High performance. Sustained.", kind: "milestone", level: 90, duration: "4.5 sec", intensity: "Cinematic", trigger: "Sustained level reached" },
  { id: "one", title: "1%", copy: "You didn’t get here in a day.", kind: "one", level: 99, duration: "6 sec", intensity: "Rare", trigger: "Long-horizon standard met" },
];

const soundEvents: PreviewEvent[] = [...microEvents, { id: "achievement-sound", title: "Achievement", copy: "Layered glass and a calm upward resolve.", kind: "achievement", duration: "1.8 sec", intensity: "Elevated", trigger: "Achievement unlocked" }, ...milestones.slice(3)];

export function CelebrationLab() {
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<PreviewEvent | null>(null);
  const [gallerySize, setGallerySize] = useState<"small" | "normal" | "large">("normal");

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
  }, []);

  function activate(event: PreviewEvent, fullScreen = false) {
    if (sound) playTone(event.kind);
    if (haptics && "vibrate" in navigator) navigator.vibrate(event.kind === "task" || event.kind === "habit" ? 12 : event.kind === "workout" ? 24 : [18, 45, 30]);
    if (fullScreen) setCelebration(event);
    else {
      setFeedback(event.id);
      window.setTimeout(() => setFeedback((value) => value === event.id ? null : value), 1200);
    }
  }

  const allBadges = useMemo(() => [...achievements, ...milestones], []);

  return (
    <main className={`${styles.page} ${reduced ? styles.reduced : ""}`}>
      <nav className={styles.nav} aria-label="Preview navigation">
        <a href="#top" className={styles.brand}><Image src="/project-you-mark.svg" alt="Project You+" width={36} height={36}/><span>PROJECT YOU+</span></a>
        <span className={styles.previewPill}><i/> Design preview</span>
        <a href="#approval" className={styles.navLink}>Review decisions</a>
      </nav>

      <section id="top" className={styles.hero}>
        <div className={styles.heroGlow}/><div className={styles.heroGrid}/>
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Progress, given weight</p>
          <h1>Every win has<br/><em>its own gravity.</em></h1>
          <p className={styles.lede}>A restrained feedback system for Project You+. Quiet during daily execution. Unmistakable when the evidence says you’ve changed.</p>
          <div className={styles.heroActions}><a href="#micro" className={styles.primary}>Experience the system <Arrow/></a><button onClick={() => activate(milestones[2], true)} className={styles.secondary}>Preview Alignment — 80</button></div>
          <div className={styles.hierarchy}>
            {["Micro", "Meaningful", "Achievement", "Milestone"].map((label, i) => <div key={label}><span>0{i + 1}</span><b>{label}</b><i style={{width:`${32 + i * 22}%`}}/></div>)}
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        <section className={styles.auditStrip}>
          <div><span>Architecture audit</span><b>One progression system</b></div>
          <p>This preview uses the existing 13 achievement definitions, permanent 60/70/80/90/99 milestones, and sustained 1% standard as its source language. No new scoring or unlock system has been introduced.</p>
        </section>

        <Section id="micro" number="01" eyebrow="Daily feedback" title="Small actions. Precise response." copy="Routine completion stays inside the flow. Each interaction has a distinct weight, sound, and motion signature.">
          <div className={styles.microGrid}>{microEvents.map((event) => <button key={event.id} onClick={() => activate(event)} className={`${styles.microCard} ${feedback === event.id ? styles.complete : ""}`}>
            <div className={styles.microTop}><Badge event={event} size="small"/><span>{event.duration}</span></div><h3>{event.title}</h3><p>{event.copy}</p><div className={styles.actionLine}><span>{feedback === event.id ? "Complete" : "Test feedback"}</span><CompletionMark active={feedback === event.id}/></div>
          </button>)}</div>
        </Section>

        <Section id="sound" number="02" eyebrow="Sonic identity" title="One tonal family. Seven levels of meaning." copy="Original Web Audio prototypes use softened sine tones, restrained harmonic layers, short tails, and conservative volume. Tap any row to listen.">
          <div className={styles.soundBoard}>{soundEvents.map((event) => <button key={event.id} onClick={() => activate(event)} className={styles.soundRow}><SoundIcon/><div><b>{event.title}</b><span>{event.trigger}</span></div><div className={styles.wave}>{[.35,.7,.45,.9,.55,.35,.68,.42,.2].map((h,i)=><i key={i} style={{height:`${h*22}px`}}/>)}</div><span>{event.duration}</span><span>{event.intensity}</span><PlayIcon/></button>)}</div>
          <p className={styles.prototypeNote}>Prototype sound direction · generated locally in your browser · no licensed or commercial audio</p>
        </Section>

        <Section id="badges" number="03" eyebrow="Achievement objects" title="A family of status symbols." copy="Dark ceramic, optical glass, and precision lines create a scalable system. The symbol stays readable from a 28-pixel navigation mark to a full-screen reveal.">
          <div className={styles.segmented} role="group" aria-label="Badge size">{(["small","normal","large"] as const).map(size=><button key={size} onClick={()=>setGallerySize(size)} className={gallerySize===size?styles.segmentActive:""}>{size === "small" ? "32 px" : size === "normal" ? "80 px" : "Reveal"}</button>)}</div>
          <h3 className={styles.groupTitle}>Behavioral achievements</h3><div className={styles.badgeGrid}>{achievements.map((event,index)=><button key={event.id} onClick={()=>activate(event,true)} className={`${styles.badgeCard} ${styles[gallerySize]}`}><Badge event={event} size={gallerySize}/><div><b>{event.title}</b><span>{index < 3 ? "Earned · Sep 2026" : "Preview requirement"}</span></div></button>)}</div>
          <h3 className={styles.groupTitle}>Progression milestones</h3><div className={styles.milestoneGrid}>{milestones.map(event=><button key={event.id} onClick={()=>activate(event,true)} className={`${styles.milestoneCard} ${styles[gallerySize]}`}><Badge event={event} size={gallerySize}/><div><span>{event.level}</span><b>{event.title}</b></div></button>)}</div>
        </Section>

        <Section id="celebrations" number="04" eyebrow="Full-screen moments" title="Earned moments take the room." copy="Achievements form from a single point of light. Milestones use identity transformation: structure, movement, convergence, precision, then accumulated proof.">
          <div className={styles.celebrationColumns}><div><div className={styles.label}>Achievement previews</div>{achievements.map(event=><button onClick={()=>activate(event,true)} key={event.id} className={styles.selectRow}><Badge event={event} size="small"/><span>{event.title}</span><Arrow/></button>)}</div><div><div className={styles.label}>Milestone previews</div>{milestones.map(event=><button onClick={()=>activate(event,true)} key={event.id} className={styles.selectRow}><span className={styles.level}>{event.level}</span><span>{event.title}</span><Arrow/></button>)}</div></div>
        </Section>

        <Section id="higgsfield" number="05" eyebrow="Higgsfield direction" title="Storyboard first. Render after approval." copy="The final assets would enhance the milestone layer while native motion remains the reliable fallback. No Higgsfield credits have been used.">
          <div className={styles.storyGrid}>{milestones.map((event,index)=><article key={event.id} className={`${styles.storyCard} ${styles[`story_${event.id}`]}`}><header><span>0{index+1}</span><b>{event.level} — {event.title}</b></header><div className={styles.intensity} aria-label={`Intensity ${index+1} of 5`}>{Array.from({length:5},(_,dot)=><i key={dot} className={dot<=index?styles.intensityOn:""}/>)}</div><div className={styles.frames}><i/><i/><i/></div><p>{storyCopy(event.id)}</p><small>{event.id === "one" ? "6–8 sec · accumulated proof → stillness → approved 1% mark" : `${3 + index * .5} sec · intensity ${index+1}/5 · native fallback included`}</small></article>)}</div>
          <details className={styles.prompt}><summary>View proposed render prompt</summary><p>Cinematic abstract identity transformation in deep obsidian space, precision architectural geometry, controlled violet-white volumetric light, subtle graphite and optical-glass material, trajectory lines converging into a central badge silhouette, refined environmental reflections, nearly black negative space, no text, no people, no trophy, no confetti, no game aesthetics, premium product-film restraint, centered mobile-safe composition, seamless resolved final frame.</p></details>
        </Section>

        <Section id="settings" number="06" eyebrow="Personal control" title="Feedback respects the person using it." copy="Sound, haptics, and motion remain independent. Every sound has a visual counterpart, and reduced motion replaces sweeping movement with a clean fade.">
          <div className={styles.settings}><Toggle label="Sound effects" sub="Completion and interface sounds" value={sound} onChange={setSound}/><Toggle label="Haptics" sub="Light, medium, and success patterns where supported" value={haptics} onChange={setHaptics}/><Toggle label="Reduce motion" sub="Immediate badge with a calm opacity transition" value={reduced} onChange={setReduced}/></div>
        </Section>

        <section id="approval" className={styles.approval}>
          <p className={styles.kicker}>Design approval</p><h2>The system is ready for your review.</h2>
          <div className={styles.decisionGrid}>{[
            ["Sound language","Soft tactile transients, warm harmonic lift, cinematic low-end only for rare moments."], ["Badge language","Obsidian ceramic, optical glass, precision geometry, restrained violet light."],
            ["Achievement motion","Point of light resolves into a badge; copy follows after the emotional beat."], ["Milestone motion","Identity transformation with a distinct narrative for 60, 70, 80, 90, and 99."],
            ["Higgsfield direction","Short mobile-safe abstract films, generated only after creative approval."], ["1% experience","Historical trajectories converge, pause in near-silence, then reveal the approved mark."],
          ].map(([title,copy])=><article key={title}><span>Approved direction</span><b>{title}</b><p>{copy}</p></article>)}</div>
          <div className={styles.stop}><i/><div><b>Production implementation has not started.</b><span>This prototype does not change task, habit, workout, scoring, achievement, or milestone behavior.</span></div></div>
        </section>
      </div>

      {celebration && <Celebration event={celebration} reduced={reduced} onClose={()=>setCelebration(null)}/>} 
    </main>
  );
}

function Section({id,number,eyebrow,title,copy,children}:{id:string;number:string;eyebrow:string;title:string;copy:string;children:React.ReactNode}) { return <section id={id} className={styles.section}><header className={styles.sectionHead}><span>{number}</span><div><p>{eyebrow}</p><h2>{title}</h2><div>{copy}</div></div></header>{children}</section> }

function Toggle({label,sub,value,onChange}:{label:string;sub:string;value:boolean;onChange:(value:boolean)=>void}) { return <button className={styles.toggleRow} onClick={()=>onChange(!value)} role="switch" aria-checked={value}><div><b>{label}</b><span>{sub}</span></div><i className={value?styles.on:""}><u/></i></button> }

function Celebration({event,reduced,onClose}:{event:PreviewEvent;reduced:boolean;onClose:()=>void}) { const milestone=event.kind==="milestone"||event.kind==="one"; return <div className={`${styles.overlay} ${milestone?styles.cinematic:""}`} role="dialog" aria-modal="true" aria-label={`${event.title} preview`}><div className={styles.ambient}/><div className={styles.trajectory}/><button className={styles.close} onClick={onClose} aria-label="Close preview">×</button><div className={styles.previewFlag}>Preview · {reduced?"Reduced motion":"Native motion study"}</div><div className={styles.reveal}><span className={styles.revealEyebrow}>{milestone?"Milestone reached":"Achievement unlocked"}</span><Badge event={event} size="hero"/><div className={styles.revealLevel}>{event.level}</div><h2>{event.title}</h2><p>{event.copy}</p>{event.kind==="one"&&<small>You became the standard you kept choosing.</small>}<button onClick={onClose}>Continue <Arrow/></button></div><div className={styles.timeline}><span/><i/><i/><i/><i/></div></div> }

function Badge({event,size}:{event:PreviewEvent;size:"small"|"normal"|"large"|"hero"}) { if(event.kind==="one") return <div className={`${styles.badge} ${styles[`badge_${size}`]} ${styles.oneBadge}`}><Image src="/progression/one-percent-badge.png" alt="Project You+ 1% mark" width={1254} height={1254}/></div>; const code=event.level ? String(event.level) : event.id; return <div className={`${styles.badge} ${styles[`badge_${size}`]} ${event.level?styles[`tier${event.level}`]:""}`}><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id={`g-${code}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".92"/><stop offset=".5" stopColor="#a88aff"/><stop offset="1" stopColor="#5940a6" stopOpacity=".55"/></linearGradient></defs><path className={styles.badgeOuter} d="M50 5 83 17 95 50 83 83 50 95 17 83 5 50 17 17Z"/><path className={styles.badgeInner} d="M50 14 75 25 86 50 75 75 50 86 25 75 14 50 25 25Z"/>{event.level?<MilestoneGlyph level={event.level}/>:<AchievementGlyph id={event.id}/>}</svg></div> }

function AchievementGlyph({id}:{id:string}) { if(id==="full-week"||id==="consistency"||id==="discipline") return <><circle cx="50" cy="50" r="24" fill="none" stroke="url(#g-consistency)" strokeWidth="3" strokeDasharray={id==="discipline"?"2 3":"12 4"}/><path d="m38 50 8 8 17-19" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></>; if(id==="goal") return <><circle cx="50" cy="50" r="22" fill="none" stroke="url(#g-goal)" strokeWidth="3"/><circle cx="50" cy="50" r="9" fill="none" stroke="white" strokeWidth="3"/><path d="M68 32 53 47" stroke="white" strokeWidth="3" strokeLinecap="round"/></>; if(id==="workout-week") return <><path d="M31 62V38M50 67V33M69 62V38" stroke="url(#g-workout-week)" strokeWidth="7" strokeLinecap="round"/><path d="M26 50h48" stroke="white" strokeWidth="3"/></>; if(id==="review"||id==="budget") return <><path d="M29 66V48l14 8 13-22 15 10" fill="none" stroke="url(#g-review)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="56" cy="34" r="4" fill="white"/></>; return <><circle cx="50" cy="50" r="23" fill="none" stroke="url(#g-first-day)" strokeWidth="3"/><path d="m38 50 8 8 17-19" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></> }
function MilestoneGlyph({level}:{level:number}) { if(level===60)return <><path d="M30 66h40M35 56h30M41 46h18M47 36h6" stroke="url(#g-60)" strokeWidth="5" strokeLinecap="round"/></>; if(level===70)return <><path d="m29 64 16-16 10 9 18-24" fill="none" stroke="url(#g-70)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m62 33 11 0 0 11" fill="none" stroke="white" strokeWidth="3"/></>; if(level===80)return <><path d="M27 32 50 50 73 32M27 68 50 50 73 68" fill="none" stroke="url(#g-80)" strokeWidth="4" strokeLinecap="round"/><circle cx="50" cy="50" r="6" fill="white"/></>; return <><path d="m50 27 18 10v26L50 73 32 63V37Z" fill="none" stroke="url(#g-90)" strokeWidth="4"/><path d="M50 37v26M39 43l22 14M61 43 39 57" stroke="white" strokeOpacity=".7" strokeWidth="2"/></> }

function CompletionMark({active}:{active:boolean}) { return <i className={`${styles.completionMark} ${active?styles.markActive:""}`}><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></i> }
function Arrow(){return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function PlayIcon(){return <i className={styles.play}><svg viewBox="0 0 20 20"><path d="m7 5 8 5-8 5Z" fill="currentColor"/></svg></i>}
function SoundIcon(){return <i className={styles.soundIcon}><svg viewBox="0 0 20 20"><path d="M4 8h3l4-3v10l-4-3H4Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M14 7c1 1.8 1 4.2 0 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></i>}

function storyCopy(id:string){return ({foundation:"Fragments settle into a stable geometric base.",momentum:"A directional pulse becomes self-sustaining movement.",alignment:"Separate trajectories converge on one luminous axis.",elite:"Graphite becomes precision metal in near silence.",one:"Months of evidence appear, converge, disappear—then the mark remains."} as Record<string,string>)[id]}

function playTone(kind:EventKind){
  const AudioCtx=window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  if(!AudioCtx)return; const ctx=new AudioCtx(); const now=ctx.currentTime; const master=ctx.createGain(); master.gain.setValueAtTime(.0001,now); master.gain.exponentialRampToValueAtTime(kind==="task"?.055:kind==="habit"?.06:.075,now+.015); const durations:Record<EventKind,number>={task:.22,habit:.34,workout:.78,day:1.1,achievement:1.8,milestone:2.7,one:3.2}; const end=now+durations[kind]; master.gain.exponentialRampToValueAtTime(.0001,end); master.connect(ctx.destination);
  const notes:Record<EventKind,number[]>={task:[620,880],habit:[440,660],workout:[174,348,523],day:[146,293,440],achievement:[261,392,523,784],milestone:[110,220,330,523],one:[98,196,294,392,588]}; notes[kind].forEach((frequency,index)=>{const oscillator=ctx.createOscillator(); const gain=ctx.createGain(); oscillator.type=index===0&&["workout","day","milestone","one"].includes(kind)?"sine":"triangle"; oscillator.frequency.setValueAtTime(frequency,now); oscillator.frequency.exponentialRampToValueAtTime(frequency*(kind==="task"?1.025:1.01),end); gain.gain.setValueAtTime(.0001,now); const delay=index*(kind==="one"?.28:kind==="milestone"?.16:.07); gain.gain.exponentialRampToValueAtTime(1/(index+1),now+delay+.02); gain.gain.exponentialRampToValueAtTime(.0001,end); oscillator.connect(gain).connect(master); oscillator.start(now+delay); oscillator.stop(end+.05);}); window.setTimeout(()=>void ctx.close(),(durations[kind]+.2)*1000);
}
