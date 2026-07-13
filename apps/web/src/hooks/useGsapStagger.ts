import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReduced, EASES, DURS } from "@/lib/motion";

export function useGsapStagger<T extends HTMLElement>(
  key: string | number | null | undefined,
  from: "start" | "center" | "bottom" | "edges" = "bottom",
  amount = 0.2
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const children = ref.current.children;
    if (!children.length) return;
    if (prefersReduced()) return;
    gsap.fromTo(
      children,
      { autoAlpha: 0, y: 6 },
      {
        autoAlpha: 1,
        y: 0,
        duration: DURS.base,
        ease: EASES.out,
        stagger: { amount, from },
      }
    );
  }, [key, from, amount]);

  return ref;
}
