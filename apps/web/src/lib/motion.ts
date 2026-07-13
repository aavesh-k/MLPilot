import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const EASES = {
  out: "power3.out",
  inOut: "power2.inOut",
  in: "power3.in",
  spring: "back.out(1.4)",
  elastic: "elastic.out(1, 0.4)",
  none: "none",
} as const;

export const DURS = {
  instant: 0,
  fast: 0.1,
  base: 0.2,
  slow: 0.3,
  deliberate: 0.4,
} as const;

export function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function safeTween(args: gsap.TweenVars): gsap.TweenVars {
  if (prefersReduced()) return { ...args, duration: 0, stagger: undefined, scrollTrigger: undefined };
  return args;
}

export function fadeIn(el: gsap.TweenTarget, delay = 0) {
  return gsap.fromTo(
    el,
    { autoAlpha: 0, y: 4, scale: 0.998 },
    safeTween({ autoAlpha: 1, y: 0, scale: 1, duration: DURS.base, ease: EASES.out, delay })
  );
}

export function staggerIn(el: gsap.TweenTarget, from: "start" | "bottom" | "center" | "edges" = "bottom") {
  return gsap.fromTo(
    el,
    { autoAlpha: 0, y: 8 },
    safeTween({
      autoAlpha: 1,
      y: 0,
      duration: DURS.base,
      ease: EASES.out,
      stagger: { amount: 0.25, from },
    })
  );
}
