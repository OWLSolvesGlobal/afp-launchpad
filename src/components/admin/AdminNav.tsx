import { NavLink } from "react-router-dom";
import { ImageIcon, Upload, RefreshCw, Users } from "lucide-react";

const tabs = [
  { to: "/admin/images", label: "Products", icon: ImageIcon },
  { to: "/admin/upload", label: "Upload", icon: Upload },
  { to: "/admin/sync", label: "Sync", icon: RefreshCw },
  { to: "/admin/partners", label: "Partners", icon: Users },
];

/** Persistent admin sub-nav so admins can hop between dashboards quickly. */
export function AdminNav() {
  return (
    <nav
      aria-label="Admin sections"
      className="border-y border-border bg-card/40 -mx-5 px-5 lg:mx-0 lg:px-0 lg:border lg:rounded-sm mb-6"
    >
      <ul className="flex flex-wrap items-center gap-1 py-2">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end
              className={({ isActive }) =>
                `eyebrow text-[10px] inline-flex items-center gap-1.5 px-3 py-1.5 border transition-colors ${
                  isActive
                    ? "bg-ink text-bone border-ink"
                    : "border-transparent text-graphite hover:text-ink hover:border-border"
                }`
              }
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}