import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top whenever the route changes.
 * Improves perceived performance + a11y (no disorienting mid-page loads).
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
};
