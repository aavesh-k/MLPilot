import { useRef, useState, useCallback, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { prefersReduced, EASES, DURS } from "@/lib/motion";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(t);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode */
    }
    if (iconRef.current && !prefersReduced()) {
      gsap.fromTo(iconRef.current,
        { scale: 1 },
        { scale: 0.65, duration: 0.08, ease: "power2.in",
          onComplete: () => {
            setTheme(next);
            gsap.to(iconRef.current, { scale: 1, duration: 0.18, ease: "back.out(2)" });
          }
        }
      );
    } else {
      setTheme(next);
    }
  }, [theme]);

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <span ref={iconRef} className="inline-flex">
        {mounted && (theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />)}
      </span>
    </Button>
  );
}
