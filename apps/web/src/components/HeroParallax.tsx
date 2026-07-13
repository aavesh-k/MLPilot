import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReduced } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

export default function HeroParallax({ children }: { children: React.ReactNode }) {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReduced() || !bgRef.current) return;
    const ctx = gsap.matchMedia();
    ctx.add("(min-width: 640px)", () => {
      gsap.to(bgRef.current, {
        y: "15%",
        ease: "none",
        scrollTrigger: {
          trigger: bgRef.current.parentElement!,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative overflow-hidden border-b border-border">
      {children}
      <div
        ref={bgRef}
        className="absolute inset-0 -z-10 will-change-transform"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--color-primary) 8%, transparent) 0%, transparent 60%)",
        }}
        aria-hidden
      />
    </div>
  );
}
