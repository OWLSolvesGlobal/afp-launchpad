import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoLoader } from "@/components/site/LogoLoader";
import { useCatalog } from "@/lib/catalog";
import { isOrderRef, rememberToken, tokenFor } from "@/lib/order-client";
import { useOrder } from "@/hooks/useOrder";
import { OrderFlow } from "@/components/order/OrderFlow";
import { HelpLink, OrderSummary } from "@/components/order/OrderParts";
import { useNoIndex } from "@/hooks/useNoIndex";

/**
 * /order/:ref — where a customer returns to see their order, send or replace
 * their proof, or cancel.
 *
 * The private token arrives after the `#` in the link (browsers never send
 * that part to a server) or from this device's memory. A missing token, a
 * wrong token and an order that does not exist all show the same page.
 */
export default function OrderStatus() {
  const { ref = "" } = useParams();
  const { hash } = useLocation();
  const { data: catalog } = useCatalog();
  const token = useMemo(() => (isOrderRef(ref) ? tokenFor(ref, hash) : null), [ref, hash]);
  const { state, refresh, show } = useOrder(isOrderRef(ref) ? ref : null, token);

  useNoIndex();
  useEffect(() => {
    document.title = "Your order — Alo Fitness Pro";
  }, []);

  // A link that worked is remembered, so this device can come back without it.
  useEffect(() => {
    if (state.phase === "ready" && token) rememberToken(ref, token);
  }, [state.phase, ref, token]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-24 md:pt-28 pb-16 md:pb-24">
        {state.phase === "loading" && (
          <div className="min-h-[50vh] grid place-items-center">
            <LogoLoader label="Loading your order" />
          </div>
        )}

        {state.phase === "not-found" && (
          <div className="max-w-xl">
            <div className="eyebrow text-graphite mb-4">Your order</div>
            <h1 className="display-lg mb-6">We couldn't find that order.</h1>
            <p className="text-graphite mb-8">
              Open the link from the device you ordered on, or use the full link you saved at checkout. If you need a
              hand, message us with your order reference.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                to="/shop/women"
                className="inline-flex items-center justify-center px-8 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                Continue Shopping
              </Link>
              <HelpLink />
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="max-w-xl" role="alert">
            <div className="eyebrow text-graphite mb-4">Your order</div>
            <h1 className="display-lg mb-6">We couldn't load your order.</h1>
            <p className="text-graphite mb-8">{state.message}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center justify-center px-8 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
              >
                Try again
              </button>
              <HelpLink orderRef={isOrderRef(ref) ? ref : undefined} />
            </div>
          </div>
        )}

        {state.phase === "ready" && token && (
          <>
            <div className="eyebrow text-graphite mb-4">Order {state.view.order.ref}</div>
            <h1 className="display-lg mb-8 md:mb-10">Your order.</h1>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-7">
                <OrderFlow
                  view={state.view}
                  token={token}
                  cibcEnabled={catalog?.config.paymentsTransferEnabled ?? false}
                  variant="status"
                  onView={show}
                  onRefresh={() => void refresh()}
                />
              </div>
              <aside className="lg:col-span-5">
                <div className="lg:sticky lg:top-24">
                  <OrderSummary order={state.view.order} />
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
