import { useCallback, useRef, useState } from "react";
import gsap from "gsap";

export function useAnimatedExit(duration = 0.2) {
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

  const exit = useCallback(
    (onComplete?: () => void) => {
      if (animating.current || !ref.current) return;
      animating.current = true;
      gsap.to(ref.current, {
        autoAlpha: 0,
        scale: 0.95,
        duration,
        ease: "power2.in",
        onComplete: () => {
          setVisible(false);
          animating.current = false;
          onComplete?.();
        },
      });
    },
    [duration]
  );

  const reset = useCallback(() => {
    setVisible(true);
    animating.current = false;
  }, []);

  return { visible, ref, exit, reset };
}
