import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { actorName, adminGet, describeAction, when, type AdminError, type AuditEntry } from "./api";
import { ErrorNote, ListSkeleton, card } from "./parts";

/** Who did what, and when. Read-only: nothing here can be edited or removed. */
export default function Activity() {
  const query = useQuery<{ entries: AuditEntry[] }, AdminError>({ queryKey: ["admin", "audit"], queryFn: () => adminGet("audit"), refetchInterval: 60_000 });
  const entries = query.data?.entries ?? [];
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="display-lg">Activity.</h1>
        <p className="text-sm text-graphite mt-3">A permanent record of everything that happens to an order. It can't be edited or deleted.</p>
      </div>
      {query.isLoading ? (
        <ListSkeleton rows={5} />
      ) : !query.data ? (
        <ErrorNote message={query.error?.message ?? "We couldn't load the activity."} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="font-medium">Nothing has happened yet.</p>
        </div>
      ) : (
        <ol className={`${card} divide-y divide-border`}>
          {entries.map((e, i) => (
            <li key={i} className="px-5 py-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <span className="font-medium">{describeAction(e.action)}</span>
                {e.orderRef && (
                  <>
                    {" · "}
                    <Link to={`/admin/orders/${e.orderRef}`} className="underline underline-offset-4 hover:text-accent tabular-nums">
                      {e.orderRef}
                    </Link>
                  </>
                )}
                {e.action === "settings_changed" && e.detail && <span className="text-graphite"> · {e.detail}</span>}
              </div>
              <div className="text-xs text-graphite">
                {when(e.at)} · {actorName(e.actor)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
