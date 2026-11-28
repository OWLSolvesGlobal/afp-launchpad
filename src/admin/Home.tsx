import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatBbd } from "@/lib/catalog-core";
import { adminGet, ago, type AdminError, type AdminOrder, type Summary } from "./api";
import { ErrorNote, ListSkeleton, Skeleton, StatusPill, card } from "./parts";

/** What the owner should do next with an order that needs her. */
function nextStep(o: AdminOrder): string {
  if (o.status === "proof_uploaded") return "Check the proof";
  if (o.status === "paid") return o.fulfillment === "pickup" ? "Hand over, then mark collected" : "Deliver, then mark delivered";
  if (o.needsLoyverse) return "Ring up in Loyverse";
  return "Open";
}

export function OrderCard({ order }: { order: AdminOrder }) {
  const since = order.status === "proof_uploaded" ? order.proofUploadedAt : order.status === "paid" ? order.paidAt : order.createdAt;
  return (
    <Link
      to={`/admin/orders/${order.ref}`}
      className={`${card} block p-5 hover:border-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold truncate">{order.customerName}</div>
          <div className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">
            {order.ref} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </div>
        </div>
        <div className="font-serif text-2xl tabular-nums shrink-0">{formatBbd(order.totalCents)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={order.status} />
          {order.needsLoyverse && (
            <span className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border border-dashed border-foreground/50">
              Not yet in Loyverse
            </span>
          )}
          <span className="text-xs text-graphite">{ago(since)}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          {nextStep(order)} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${card} p-4 md:p-5`}>
      <div className="text-[11px] text-graphite uppercase tracking-wider">{label}</div>
      <div className="font-serif text-2xl sm:text-3xl tabular-nums mt-1 whitespace-nowrap">{value}</div>
      {hint && <div className="text-xs text-graphite mt-1">{hint}</div>}
    </div>
  );
}

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Barbados", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

/** Home: "Does anything need me right now?" */
export default function Home() {
  const summary = useQuery<Summary, AdminError>({ queryKey: ["admin", "summary"], queryFn: () => adminGet("summary"), refetchInterval: 30_000 });
  const needs = useQuery<{ orders: AdminOrder[] }, AdminError>({
    queryKey: ["admin", "orders", "needs", ""],
    queryFn: () => adminGet("orders?view=needs"),
    refetchInterval: 30_000,
  });
  const orders = needs.data?.orders ?? [];
  const s = summary.data;

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow text-graphite mb-2">{greeting()}</div>
        <h1 className="display-lg">
          {needs.isLoading || !needs.data ? "Your orders." : orders.length === 0 ? "You're all caught up." : orders.length === 1 ? "One order needs you." : `${orders.length} orders need you.`}
        </h1>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {s ? (
          <>
            <Tile label="Proofs to check" value={String(s.proofsWaiting)} />
            <Tile label="To deliver" value={String(s.toDeliver)} />
            <Tile label="Paid today" value={formatBbd(s.paidTodayCents)} hint={`${s.paidTodayCount} ${s.paidTodayCount === 1 ? "order" : "orders"}`} />
            <Tile label="To ring up in Loyverse" value={String(s.needsLoyverse)} hint={s.needsLoyverse === 0 ? "All recorded" : "Paid, not yet at the till"} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)
        )}
      </section>

      {/* Said only when email alerts can't be relied on. Silent when they work. */}
      {s && s.emailAlerts && s.emailAlerts !== "ok" && (
        <p role="status" className="border border-dashed border-foreground/50 rounded-2xl px-5 py-4 text-sm">
          {s.emailAlerts === "off"
            ? "Email alerts aren't switched on yet, so new proofs won't email you. Check here for them."
            : "An email alert couldn't be sent in the last day. Check here for new proofs, and let Brandon know."}
        </p>
      )}

      {/* Said only when paid orders have sat un-rung-up for more than a day. */}
      {s && (s.loyverseOverdue ?? 0) > 0 && (
        <p role="status" className="border border-dashed border-foreground/50 rounded-2xl px-5 py-4 text-sm">
          {s.loyverseOverdue === 1 ? "One paid order has" : `${s.loyverseOverdue} paid orders have`} waited more than a day to be rung up in
          Loyverse. Until then the shop shows fewer in stock than you have.{" "}
          <Link to="/admin/orders" className="underline underline-offset-4 hover:text-accent">
            See orders
          </Link>
        </p>
      )}

      <section aria-labelledby="needs-you">
        <h2 id="needs-you" className="eyebrow text-graphite mb-4">
          Needs you
        </h2>
        {needs.isLoading ? (
          <ListSkeleton />
        ) : needs.error && !needs.data ? (
          <ErrorNote message={needs.error.message} onRetry={() => void needs.refetch()} />
        ) : orders.length === 0 ? (
          <div className={`${card} p-8 text-center`}>
            <Sparkles className="w-6 h-6 mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
            <p className="font-medium">Nothing is waiting on you.</p>
            <p className="text-sm text-graphite mt-1">New proofs of payment will appear here as customers send them.</p>
            <Link to="/admin/orders" className="inline-block mt-4 text-sm underline underline-offset-4 hover:text-accent">
              See all orders
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.ref} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
