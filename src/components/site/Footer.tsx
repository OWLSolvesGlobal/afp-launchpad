import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import afpLogo from "@/assets/afp-logo.png";

const cols = [
  {
    title: "Shop",
    links: [
      { label: "Men", to: "/shop/men" },
      { label: "Women", to: "/shop/women" },
      { label: "New Drops", to: "/shop/men?sort=new" },
      { label: "Bestsellers", to: "/shop/women?sort=best" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Shipping", to: "/faq" },
      { label: "Returns", to: "/faq" },
      { label: "Size Guide", to: "/faq" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Instagram", to: "https://instagram.com/alofitnesspro" },
      { label: "FAQ", to: "/faq" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="bg-ink text-bone">
      {/* Marquee */}
      <div className="border-y border-ink-soft py-4 overflow-hidden">
        <div className="marquee-track flex whitespace-nowrap font-display uppercase text-2xl md:text-4xl tracking-tight">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 pr-8">
              {Array.from({ length: 6 }).map((_, j) => (
                <span key={j} className="flex items-center gap-8">
                  Iron over everything
                  <span className="text-safety">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="container py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <Link to="/" aria-label="Alo Fitness Pro — Home" className="inline-flex items-center">
            <img src={afpLogo} alt="Alo Fitness Pro" className="h-12 w-auto invert" />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-bone/70 leading-relaxed">
            Strength-built apparel for the rack and the platform.
            Shipped worldwide.
          </p>
          <a
            href="https://instagram.com/alofitnesspro"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 eyebrow link-safety"
          >
            <Instagram className="w-4 h-4" /> @alofitnesspro
          </a>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <div className="eyebrow text-bone/60 mb-4">{c.title}</div>
            <ul className="space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm hover:text-safety transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-soft">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-bone/50">
          <span>© {new Date().getFullYear()} Alo Fitness Pro. All rights reserved.</span>
          <span className="eyebrow">Ships worldwide · USD</span>
        </div>
      </div>
    </footer>
  );
};
