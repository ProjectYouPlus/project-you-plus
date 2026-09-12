"use client";
import { useEffect } from "react";
import { track } from "@/lib/website/client";
export function WebsiteMotion() {
  useEffect(() => {
    track("homepage_visit");
    const root = document.querySelector<HTMLElement>(".youplus-site"); if (!root) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let lightScroll = scrollY;
    let lastFrame = performance.now();
    const atmosphere = root.querySelector<HTMLElement>(".atmosphere-light");
    const sweep = root.querySelector<HTMLElement>(".atmosphere-sweep");
    const hero = root.querySelector<HTMLElement>(".site-hero");
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const story = root.querySelector<HTMLElement>(".product-story");
    const layers = Array.from(root.querySelectorAll<HTMLElement>(".device-layer"));
    const milestones = Array.from(root.querySelectorAll<HTMLElement>(".milestone"));
    const chapters = Array.from(root.querySelectorAll<HTMLElement>(".story-chapter"));
    const reveal = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("revealed"); reveal.unobserve(entry.target); } }); }, { threshold: 0.12 });
    root.querySelectorAll("[data-reveal]").forEach(node => reveal.observe(node));
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    function update(time = performance.now()) {
      raf = 0;
      if (media.matches) { root?.removeAttribute("data-motion"); return; }
      root?.setAttribute("data-motion", "true");
      const height = innerHeight;
      if (atmosphere) {
        // Ease only the light, leaving native scrolling and navigation immediate.
        const elapsed = Math.min(64, Math.max(1, time - lastFrame));
        lightScroll += (scrollY - lightScroll) * (1 - Math.exp(-elapsed / 95));
        const phase = lightScroll / Math.max(600, height * 1.15);
        atmosphere.style.transform = `translate3d(${Math.sin(phase * .7) * 24}vw, ${Math.sin(phase * .5) * 16}vh, 0) scale(${1 + Math.sin(phase * .4) * .09})`;
        if (sweep) sweep.style.transform = `translate3d(${Math.sin(phase * .55) * 28}vw, ${Math.sin(phase * .8) * 20}vh, 0) rotate(${-26 + Math.sin(phase * .45) * 22}deg)`;
      }
      lastFrame = time;
      const hp = hero ? clamp(-hero.getBoundingClientRect().top / (height * 1.2)) : 0;
      root?.style.setProperty("--hero-progress", String(hp));
      scenes.forEach(scene => { const box = scene.getBoundingClientRect(); if (box.bottom > -height && box.top < height * 2) scene.style.setProperty("--scene", String(clamp((height * .8 - box.top) / Math.max(height, box.height * .8)))); });
      if (story && innerWidth >= 800) {
        const box = story.getBoundingClientRect();
        if (box.bottom > 0 && box.top < height) {
          let active = 0;
          chapters.forEach((chapter, index) => { if (chapter.getBoundingClientRect().top < height * .52) active = index; });
          layers.forEach((layer, index) => { layer.dataset.active = String(index === active); });
          story.style.setProperty("--device-y", `${Math.sin(clamp(-box.top / box.height) * Math.PI) * -18}px`);
        }
      }
      milestones.forEach((milestone, index) => { const box = milestone.getBoundingClientRect(); const distance = Math.abs(box.top + box.height / 2 - height / 2); milestone.style.setProperty("--emphasis", String(Math.max(.24, 1 - distance / (height * .7)))); milestone.style.setProperty("--milestone-index", String(index)); });
      if (atmosphere && Math.abs(scrollY - lightScroll) > .25) raf = requestAnimationFrame(update);
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(update); }
    function click(event: MouseEvent) { const target = (event.target as Element).closest<HTMLAnchorElement>("[data-beta-cta]"); if (target) track(`${target.dataset.betaCta}_beta_cta_click`); }
    root.addEventListener("click", click); window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule); media.addEventListener("change", schedule); update();
    return () => { cancelAnimationFrame(raf); reveal.disconnect(); root.removeEventListener("click", click); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); media.removeEventListener("change", schedule); };
  }, []);
  return null;
}
