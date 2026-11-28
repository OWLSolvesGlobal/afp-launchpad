import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { formatBbd } from "@/lib/catalog-core";
import { STATUS_LABELS } from "@/lib/orders-core";
import { cn } from "@/lib/utils";
import { adminGet, when, type AdminError, type AdminOrder } from "./api";
import { OrderCard } from "./Home";
import { ErrorNote, ListSkeleton, StatusPill, card, inputCls } from "./parts";

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["proof_uploaded", STATUS_LABELS.proof_uploaded],
  ["paid", STATUS_LABELS.paid],
  ["reserved", STATUS_LABELS.reserved],
  ["delivered", STATUS_LABELS.delivered],
  ["expired", STATUS_LABELS.expired],
  ["rejected", STATUS_LABELS.rejected],
  ["cancelled", STATUS_LABELS.cancelled],
];

/** Every order, with filters in plain words and one search box. */
export default function Orders() {
  const [view, setView] = useState("all");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setQ(typed.trim()), 300);
    return () => window.clearTimeout(id);
  }, [typed]);

  const list = useQuery<{ orders: AdminOrder[] }, AdminError>({
    queryKey: ["admin", "orders", view, q],
    queryFn: () => adminGet(`orders?view=${view}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
  const orders = list.data?.orders ?? [];

  return (
    <div className="space-y-6">
      <h1 className="display-lg">Orders.</h1>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-graphite" aria-hidden="true" />
        <label htmlFor="order-search" className="sr-only">
          Search orders by reference, name, phone or email
        </label>
        <input
          id="order-search"
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Search by reference, name, phone or email"
          className={cn(inputCls, "pl-11")}
        />
      </div>

      <div role="radiogroup" aria-label="Show" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:flex-wrap">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={view === id}
            onClick={() => setView(id)}
            className={cn(
              "shrink-0 h-11 px-4 rounded-full text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
              view === id ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.error && !list.data ? (
        <ErrorNote message={list.error.message} onRetry={() => void list.refetch()} />
      ) : orders.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="font-medium">{q ? "No orders match that search." : "No orders here yet."}</p>
          <p className="text-sm text-graphite mt-1">{q ? "Try a name, a phone number or the AFP reference." : "They'll appear as customers check out."}</p>
        </div>
      ) : (
        <>
          {/* Phone: cards. */}
          <div className="space-y-3 lg:hidden">
            {orders.map((o) => (
              <OrderCard key={o.ref} order={o} />
            ))}
          </div>
          {/* Desktop: a table, where comparing rows helps. */}
          <div className={`${card} hidden lg:block overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-graphite uppercase tracking-wider border-b border-border">
                  <th scope="col" className="font-medium px-5 py-3">Customer</th>
                  <th scope="col" className="font-medium px-5 py-3">Reference</th>
                  <th scope="col" className="font-medium px-5 py-3">Placed</th>
                  <th scope="col" className="font-medium px-5 py-3">Status</th>
                  <th scope="col" className="font-medium px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.ref} className="hover:bg-muted/40">
                    <td className="px-5 py-4">
                      <Link to={`/admin/orders/${o.ref}`} className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded">
                        {o.customerName}
                      </Link>
                      <div className="text-xs text-graphite">{o.fulfillment === "pickup" ? "Pickup" : "Delivery"} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}</div>
                    </td>
                    <td className="px-5 py-4 tabular-nums">{o.ref}</td>
                    <td className="px-5 py-4 text-graphite">{when(o.createdAt)}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={o.status} />
                      {o.needsLoyverse && <div className="text-xs text-graphite mt-1">Not yet in Loyverse</div>}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">{formatBbd(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
