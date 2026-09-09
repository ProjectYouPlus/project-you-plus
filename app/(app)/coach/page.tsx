import { CoachChat } from "@/components/coach/coach-chat";

export default function CoachPage() {
  return (
    <main className="py-shell-narrow">
      <header className="mb-5"><div className="py-eyebrow mb-2 text-accent-text">Your personal chief of staff</div><h1 className="py-title">AI Coach</h1><p className="py-subtitle max-w-[620px]">Ask about your goals, schedule, habits, health, money or what to do next. Your coach reasons from your Project You+ context.</p></header>
      <section className="py-card overflow-hidden"><CoachChat /></section>
    </main>
  );
}
