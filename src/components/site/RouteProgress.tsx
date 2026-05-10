import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Slim top progress bar + brief content fade triggered on every route change.
 * Pure presentation — no router/data coupling, just listens to pathname.
 */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const rafIds = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }

    // Reset any in-flight animations
    rafIds.current.forEach((id) => cancelAnimationFrame(id));
    timers.current.forEach((id) => clearTimeout(id));
    rafIds.current = [];
    timers.current = [];

    setActive(true);
    setProgress(0);

    rafIds.current.push(requestAnimationFrame(() => setProgress(20)));
    timers.current.push(window.setTimeout(() => setProgress(55), 90));
    timers.current.push(window.setTimeout(() => setProgress(82), 220));
    // Complete + fade out
    timers.current.push(window.setTimeout(() => setProgress(100), 380));
    timers.current.push(window.setTimeout(() => setActive(false), 620));
    timers.current.push(window.setTimeout(() => setProgress(0), 820));

    return () => {
      rafIds.current.forEach((id) => cancelAnimationFrame(id));
      timers.current.forEach((id) => clearTimeout(id));
    };
  }, [pathname]);

  return (
    <>
      {/* Top progress bar */}
      <div
        aria-hidden
        className="fixed top-0 inset-x-0 z-[60] h-[2px] pointer-events-none"
      >
        <div
          className="h-full bg-gradient-to-r from-safety via-ink to-safety transition-[width,opacity] duration-300 ease-out shadow-[0_0_12px_hsl(var(--safety)/0.6)]"
          style={{
            width: `${progress}%`,
            opacity: active ? 1 : 0,
          }}
        />
      </div>

      {/* Subtle bone wash that ripples in then disappears */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[55] pointer-events-none transition-opacity duration-500 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-safety/30" />
        <div className="absolute inset-0 bg-background/0" />
      </div>
    </>
  );
}