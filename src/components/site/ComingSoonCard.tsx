import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/brand";

/** Placeholder card for a category with no purchasable items yet. */
export function ComingSoonCard({ collectionLabel }: { collectionLabel: string }) {
  return (
    <a
      href={waLink(`Hi! When are more ${collectionLabel} pieces dropping?`)}
      target="_blank"
      rel="noreferrer"
      className="group border border-dashed border-graphite/40 bg-card flex flex-col items-center justify-center text-center p-8 aspect-[4/5] hover:border-ink transition-colors"
    >
      <span className="w-12 h-12 grid place-items-center bg-ink text-bone mb-5 group-hover:bg-accent transition-colors">
        <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
      </span>
      <div className="eyebrow text-graphite mb-3">Coming soon</div>
      <div className="font-medium mb-2">More {collectionLabel} on the way</div>
      <div className="text-sm text-graphite max-w-[24ch]">
        Message us on WhatsApp for first access when they land.
      </div>
    </a>
  );
}
