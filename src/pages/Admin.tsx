import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Inbox, Settings as Cog } from "lucide-react";
import afpLogo from "@/assets/afp-logo.png";
import { useNoIndex } from "@/hooks/useNoIndex";
import { cn } from "@/lib/utils";
import { adminGet, type AdminError } from "@/admin/api";
import { Skeleton, primaryBtn } from "@/admin/parts";
import Home from "@/admin/Home";
import Orders from "@/admin/Orders";
import OrderDetail from "@/admin/OrderDetail";
import Settings from "@/admin/Settings";
import Activity from "@/admin/Activity";

const NAV = [
  { to: "/admin", label: "Needs you", icon: Inbox, end: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList, end: false },
  { to: "/admin/settings", label: "Settings", icon: Cog, end: false },
];

/**
 * The owner's portal.
 *
 * This page is ordinary public code: hiding it protects nothing. What is
 * protected is the data, and every request for it is checked by the Worker
 * against a signed Cloudflare Access token. Without one, this page can show
 * only the "please sign in" screen below.
 *
 * It is a lazy route, so none of it ships to shoppers.
 */
export default function Admin() {
  useNoIndex();
  useEffect(() => {
    document.title = "AFP Portal";
  }, []);

  const me = useQuery<{ email: string }, AdminError>({
    queryKey: ["admin", "me"],
    queryFn: () => adminGet("me"),
    retry: false,
    refetchInterval: 5 * 60_000,
  });

  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6" role="status" aria-label="Opening the portal">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-40 mx-auto" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!me.data) {
    const offline = me.error && !me.error.signedOut;
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <main id="main" className="w-full max-w-md text-center">
          <img src={afpLogo} alt="Alo Fitness Pro" className="h-12 w-auto mx-auto mb-8" />
          <h1 className="display-lg mb-4">{offline ? "We couldn't open the portal." : "Please sign in."}</h1>
          <p className="text-graphite mb-8">
            {offline
              ? me.error?.message
              : "The AFP portal is for the shop's owner. Sign in with your email and the one-time code we send you."}
          </p>
          {/* Reloading sends the browser back through Cloudflare Access, which shows its sign-in page. */}
          <button type="button" className={primaryBtn} onClick={() => window.location.reload()}>
            {offline ? "Try again" : "Sign in"}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={afpLogo} alt="Alo Fitness Pro" className="h-8 w-auto" />
            <span className="eyebrow text-graphite">Portal</span>
          </div>
          <nav aria-label="Portal" className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center h-11 px-4 rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                    isActive ? "bg-foreground text-background" : "hover:bg-muted",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="text-xs text-graphite truncate max-w-[40vw]" title={me.data.email}>
            {me.data.email.split("@")[0]}
          </div>
        </div>
      </header>

      <main id="main" className="container py-8 md:py-12">
        <Routes>
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:ref" element={<OrderDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="activity" element={<Activity />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      {/* Phone: the four places, within thumb reach. */}
      <nav aria-label="Portal" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-3">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 h-16 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/40",
                    isActive ? "font-semibold text-foreground" : "text-graphite",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <n.icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                    {n.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
