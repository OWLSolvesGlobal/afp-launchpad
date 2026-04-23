import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import afpLogo from "@/assets/afp-logo.png";

const nav = [
  { to: "/shop/men", label: "Men" },
  { to: "/shop/women", label: "Women" },
  { to: "/shop/men?sort=new", label: "New Drops" },
  { to: "/about", label: "About" },
];

export const Header = ({ transparent = false }: { transparent?: boolean }) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Always light header on the new bone-white site
  void transparent;
  const elevated = scrolled;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        elevated
          ? "bg-background/90 backdrop-blur-md text-foreground border-b border-border"
          : "bg-background text-foreground border-b border-transparent"
      )}
    >
      <div className="container flex items-center justify-between h-14 md:h-16">
        <button
          aria-label="Open menu"
          className="md:hidden p-2 -ml-2"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/" aria-label="Alo Fitness Pro — Home" className="flex items-center">
          <img
            src={afpLogo}
            alt="Alo Fitness Pro"
            className="h-8 md:h-10 w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "text-[11px] uppercase tracking-[0.32em] font-medium link-safety transition-opacity",
                  isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <button aria-label="Search" className="p-2 hover:opacity-60 transition-opacity">
            <Search className="w-5 h-5" />
          </button>
          <button aria-label="Cart" className="p-2 hover:opacity-60 transition-opacity relative">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 bg-foreground text-background text-[10px] font-stencil w-4 h-4 grid place-items-center rounded-full">
              0
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-background text-foreground md:hidden animate-fade-up">
          <div className="container flex items-center justify-between h-14">
            <Link to="/" aria-label="Alo Fitness Pro — Home" className="flex items-center">
              <img src={afpLogo} alt="Alo Fitness Pro" className="h-8 w-auto" />
            </Link>
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2 -mr-2">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="container flex flex-col gap-6 mt-12">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="font-serif text-5xl tracking-tight leading-none"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-8 pt-8 border-t border-border eyebrow text-graphite">
              @alofitnesspro
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
