"use client";

import { useState, useTransition } from "react";
import { updateProfileName } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types";

export function ProfileView({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.fullName ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const fd = new FormData();
    fd.set("fullName", name);
    startTransition(() => { void (async () => { await updateProfileName(fd); setEditing(false); })(); });
  }

  return (
    <div>
      <div className="mb-7 flex items-center gap-4 border-b border-border pb-7">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-[24px] font-bold text-accent-text">{(profile.fullName ?? "?")[0]}</div>
        <div className="flex-1">
          {editing ? <div className="flex items-center gap-2"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="rounded-lg border border-border bg-bg px-3 py-2 text-[16px] text-text-1 outline-none focus:border-accent" /><button onClick={handleSave} disabled={isPending} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white">Save</button></div> : <><div className="text-[24px] font-bold tracking-tight text-text-1">{profile.fullName ?? "Guest"}</div><button onClick={() => setEditing(true)} className="mt-1 text-[13px] text-text-2">Edit name</button></>}
        </div>
        <div className="hidden rounded-full bg-positive-soft px-3 py-1.5 text-[12px] font-semibold text-positive sm:block">Blueprint active</div>
      </div>

      {profile.blueprint ? <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          {profile.blueprint.vision && <BlueprintSection eyebrow="Vision" title="Where you are going"><p className="m-0 text-[17px] leading-relaxed text-text-1">{profile.blueprint.vision}</p></BlueprintSection>}
          {profile.blueprint.goals && profile.blueprint.goals.length > 0 && <BlueprintSection eyebrow="Top goals" title="What matters most"><div className="space-y-3">{profile.blueprint.goals.map((g, i) => <div key={i} className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">{i+1}</div><div className="text-[15px] font-medium text-text-1">{g}</div></div>)}</div></BlueprintSection>}
        </div>
        <div className="space-y-6">
          {profile.blueprint.habits && profile.blueprint.habits.length > 0 && <BlueprintSection eyebrow="Keystone habits" title="What keeps you on track"><div className="flex flex-wrap gap-2">{profile.blueprint.habits.map((h, i) => <span key={i} className="rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent-text">{h}</span>)}</div></BlueprintSection>}
          <BlueprintSection eyebrow="90-day mission" title="Build Momentum"><p className="m-0 text-[14px] leading-relaxed text-text-2">Create financial cushion, protect workout consistency, and turn the side business into repeatable weekly execution.</p></BlueprintSection>
        </div>
      </div> : <div className="py-10 text-center text-[14px] text-text-2">Complete onboarding to generate your Personal Blueprint.</div>}
    </div>
  );
}

function BlueprintSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-5"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">{eyebrow}</div><h2 className="m-0 mb-3 mt-1.5 text-[19px] font-semibold tracking-tight text-text-1">{title}</h2>{children}</section>;
}
