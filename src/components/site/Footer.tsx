import { Link } from "react-router-dom";
import { Instagram, MessageCircle } from "lucide-react";
import afpLogo from "@/assets/afp-logo.png";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, PHONE_DISPLAY, TAGLINE, waLink } from "@/lib/brand";

const cols = [
  {
    title: "Shop",
    links: [
      { label: "Women", to: "/shop/women" },
      { label: "Men", to: "/shop/men" },
      { label: "New Drops", to: "/shop/women?sort=new" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Delivery", to: "/faq#shipping" },
      { label: "Exchanges", to: "/faq#returns" },
      { label: "Sizing", to: "/faq#sizing" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "FAQ", to: "/faq" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="bg-ink text-bone">
      {/* Marquee */}
      <div className="border-y border-ink-soft py-5 overflow-hidden">
        <div className="marquee-track flex whitespace-nowrap font-serif italic text-2xl md:text-4xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 pr-8">
              {Array.from({ length: 6 }).map((_, j) => (
                <span key={j} className="flex items-center gap-8">
                  {TAGLINE}
                  <span className="text-bone/40 not-italic">✦</span>
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
            Activewear designed in Barbados for women and men — the studio,
            the green, and everywhere in between.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={waLink("Hi AFP!")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 eyebrow hover:text-bone transition-colors text-bone/70"
            >
              <MessageCircle className="w-4 h-4" /> {PHONE_DISPLAY}
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 eyebrow hover:text-bone transition-colors text-bone/70"
            >
              <Instagram className="w-4 h-4" /> {INSTAGRAM_HANDLE}
            </a>
          </div>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <div className="eyebrow text-bone/60 mb-4">{c.title}</div>
            <ul className="space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm hover:text-bone transition-colors text-bone/70">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-soft">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-bone/75">
          <span>© {new Date().getFullYear()} Alo Fitness Pro. All rights reserved.</span>
          <span className="eyebrow">Island-wide delivery across Barbados · Prices in BBD</span>
        </div>
      </div>
    </footer>
  );
};
