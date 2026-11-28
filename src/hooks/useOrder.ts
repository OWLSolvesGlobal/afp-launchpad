import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOrder, isFailure, type OrderView } from "@/lib/order-client";

export type OrderState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "error"; message: string }
  | { phase: "ready"; view: OrderView };

/**
 * Load one order from the server and keep it fresh while its status can still
 * change (waiting for payment, or for the owner to check a proof).
 */
export function useOrder(ref: string | null, token: string | null, initial?: OrderView) {
  const [state, setState] = useState<OrderState>(initial ? { phase: "ready", view: initial } : { phase: "loading" });
  const latest = useRef(0);
  // A view handed over by the caller (the order just reserved) needs no first fetch.
  const skipFirst = useRef(Boolean(initial));

  const refresh = useCallback(async () => {
    if (!ref || !token) {
      setState({ phase: "not-found" });
      return;
    }
    const call = ++latest.current;
    const result = await fetchOrder(ref, token);
    if (call !== latest.current) return;
    if (!isFailure(result)) setState({ phase: "ready", view: result });
    else if (result.status === 404) setState({ phase: "not-found" });
    // A failed refresh keeps whatever is already on screen.
    else setState((prev) => (prev.phase === "ready" ? prev : { phase: "error", message: result.error }));
  }, [ref, token]);

  /** Show a view the server just returned (after reserving, uploading or cancelling). */
  const show = useCallback((view: OrderView) => {
    latest.current += 1;
    setState({ phase: "ready", view });
  }, []);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setState({ phase: "loading" });
    void refresh();
  }, [refresh]);

  const status = state.phase === "ready" ? state.view.order.status : null;
  useEffect(() => {
    if (status !== "reserved" && status !== "proof_uploaded") return;
    const id = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, refresh]);

  return { state, refresh, show };
}
