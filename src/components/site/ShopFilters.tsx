import { useState } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  categories: string[];
  sizes: string[];
  colors: string[];
  priceMax: number;
  sort: "featured" | "new" | "price-asc" | "price-desc";
}

export const defaultFilters: FilterState = {
  categories: [],
  sizes: [],
  colors: [],
  priceMax: 200,
  sort: "featured",
};

interface Props {
  value: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  resultCount: number;
  facets: {
    categories: string[];
    sizes: string[];
    colors: { name: string; hex: string }[];
  };
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-border py-5">
    <div className="eyebrow text-graphite mb-3">{title}</div>
    {children}
  </div>
);

const Toggle = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-xs uppercase tracking-wider border transition-colors",
      active
        ? "bg-ink text-bone border-ink"
        : "bg-transparent text-ink border-border hover:border-ink"
    )}
  >
    {children}
  </button>
);

const FilterBody = ({ value, onChange, facets }: Omit<Props, "totalCount" | "resultCount">) => {
  const toggle = <K extends "categories" | "sizes" | "colors">(key: K, val: string) => {
    const arr = value[key];
    onChange({
      ...value,
      [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
    });
  };

  return (
    <div className="text-sm">
      <Section title="Sort">
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as FilterState["sort"] })}
          className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-ink outline-none"
        >
          <option value="featured">Featured</option>
          <option value="new">Newest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </Section>

      <Section title="Category">
        <div className="flex flex-wrap gap-2">
          {facets.categories.map((c) => (
            <Toggle key={c} active={value.categories.includes(c)} onClick={() => toggle("categories", c)}>
              {c}
            </Toggle>
          ))}
        </div>
      </Section>

      <Section title="Size">
        <div className="flex flex-wrap gap-2">
          {facets.sizes.map((s) => (
            <Toggle key={s} active={value.sizes.includes(s)} onClick={() => toggle("sizes", s)}>
              {s}
            </Toggle>
          ))}
        </div>
      </Section>

      <Section title="Color">
        <div className="flex flex-wrap gap-2">
          {facets.colors.map((c) => {
            const active = value.colors.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggle("colors", c.name)}
                title={c.name}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-all",
                  active ? "border-ink scale-110" : "border-border hover:border-ink/50"
                )}
                style={{ backgroundColor: c.hex }}
                aria-label={c.name}
              />
            );
          })}
        </div>
      </Section>

      <Section title={`Max Price · $${value.priceMax}`}>
        <input
          type="range"
          min={20}
          max={200}
          step={10}
          value={value.priceMax}
          onChange={(e) => onChange({ ...value, priceMax: Number(e.target.value) })}
          className="w-full accent-ink"
        />
      </Section>
    </div>
  );
};

export const ShopFilters = (props: Props) => {
  const [open, setOpen] = useState(false);
  const activeCount =
    props.value.categories.length + props.value.sizes.length + props.value.colors.length;

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-20 self-start">
        <div className="flex items-center justify-between pb-4">
          <div className="eyebrow">Filter</div>
          {activeCount > 0 && (
            <button
              onClick={() => props.onChange(defaultFilters)}
              className="text-xs text-graphite hover:text-ink underline underline-offset-4"
            >
              Clear ({activeCount})
            </button>
          )}
        </div>
        <FilterBody {...props} />
      </aside>

      {/* Mobile trigger bar */}
      <div className="lg:hidden sticky top-14 z-30 -mx-5 px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 eyebrow"
        >
          <Filter className="w-4 h-4" /> Filter {activeCount > 0 && `(${activeCount})`}
        </button>
        <span className="text-xs text-graphite">
          {props.resultCount}/{props.totalCount}
        </span>
      </div>

      {/* Mobile bottom sheet */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-ink/50" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 bg-background max-h-[85vh] overflow-y-auto rounded-t-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="eyebrow">Filter & Sort</div>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5">
              <FilterBody {...props} />
            </div>
            <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
              <button
                onClick={() => props.onChange(defaultFilters)}
                className="flex-1 py-3 border border-border eyebrow"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-3 bg-ink text-bone eyebrow"
              >
                Show {props.resultCount}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
