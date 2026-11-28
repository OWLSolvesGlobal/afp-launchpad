import { CheckCircle2, Clock, FileCheck2, PackageCheck, Truck, XCircle } from "lucide-react";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orders-core";
import { cn } from "@/lib/utils";

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors disabled:opacity-40 disabled:hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";
export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow border border-foreground text-foreground hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";
export const quietBtn =
  "inline-flex items-center gap-1.5 min-h-11 text-sm text-graphite underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded";
export const inputCls =
  "w-full border border-border bg-background rounded-xl px-4 h-12 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";
export const card = "rounded-3xl border border-border bg-card";

const ICONS: Record<OrderStatus, typeof Clock> = {
  reserved: Clock,
  proof_uploaded: FileCheck2,
  paid: PackageCheck,
  delivered: Truck,
  expired: Clock,
  rejected: XCircle,
  cancelled: XCircle,
};

/** A status in words with an icon. Never colour alone. */
export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const Icon = status === "delivered" ? CheckCircle2 : ICONS[status];
  const strong = status === "proof_uploaded";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap border",
        strong ? "bg-foreground text-background border-foreground" : "border-border text-foreground",
        (status === "expired" || status === "cancelled" || status === "rejected") && "text-graphite",
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Grey shapes while a screen loads, sized like what replaces them. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[104px]" />
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-destructive/40 rounded-2xl p-5 space-y-3">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button type="button" className={secondaryBtn} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
