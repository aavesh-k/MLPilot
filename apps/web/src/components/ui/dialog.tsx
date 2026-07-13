import * as React from "react";
import { X } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { prefersReduced } from "@/lib/motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(open);
  const closing = React.useRef(false);

  const animateIn = React.useCallback(() => {
    if (!overlayRef.current || !panelRef.current) return;
    const reduce = prefersReduced();
    gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0 : 0.15, ease: "power2.out" });
    gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, scale: reduce ? 1 : 0.95, y: reduce ? 0 : 8 },
      { autoAlpha: 1, scale: 1, y: 0, duration: reduce ? 0 : 0.2, ease: "power3.out", delay: 0.05 }
    );
  }, []);

  const animateOut = React.useCallback(() => {
    if (!overlayRef.current || !panelRef.current || closing.current) return;
    closing.current = true;
    const reduce = prefersReduced();
    gsap.to(overlayRef.current, { autoAlpha: 0, duration: reduce ? 0 : 0.1, ease: "power2.in" });
    gsap.to(panelRef.current, {
      autoAlpha: 0,
      scale: reduce ? 1 : 0.95,
      y: reduce ? 0 : -4,
      duration: reduce ? 0 : 0.15,
      ease: "power2.in",
      onComplete: () => {
        closing.current = false;
        setMounted(false);
        onClose();
      },
    });
  }, [onClose]);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      closing.current = false;
    } else if (mounted) {
      animateOut();
    }
  }, [open, mounted, animateOut]);

  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => animateIn());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateOut();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, animateIn, animateOut]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" role="presentation">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => animateOut()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl",
          className
        )}
      >
        <button
          type="button"
          onClick={() => animateOut()}
          aria-label="Close"
          className="press absolute right-4 top-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
        {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        {children && <div className="mt-4 text-sm">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
Dialog.displayName = "Dialog";
