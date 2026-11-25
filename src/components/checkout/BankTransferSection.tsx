import { useState } from "react";
import { Check, Copy, Download, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import qrCibc from "@/assets/qr-1stpay-cibc.png";
import qrPlus from "@/assets/qr-1stpay-plus.png";

/**
 * Pay by bank QR code — rendered only when site-settings.json has
 * `paymentsTransferEnabled: true`.
 *
 * AFP is paid into its CIBC account by 1st Pay. There are two codes because
 * the bank issues two: one that only CIBC customers can pay, and "1st Pay
 * Plus", which customers of other Barbados banks can pay.
 *
 * What this section does NOT do, by design:
 *  - It takes no payment itself. The customer sends the money from their own
 *    banking app; nothing is charged by this site.
 *  - A bank QR code cannot carry the amount or the order reference, so the
 *    customer types both. They are shown large, with copy buttons.
 *  - It never asks for, or accepts, a screenshot as proof. AFP confirms every
 *    payment against its own bank record (see CLAUDE.md).
 */

export type PayerBank = "cibc" | "other";

const OPTIONS: Record<
  PayerBank,
  { label: string; hint: string; scheme: string; qr: string; file: string; alt: string }
> = {
  cibc: {
    label: "I bank with CIBC",
    hint: "CIBC Caribbean accounts only",
    scheme: "1st Pay",
    qr: qrCibc,
    file: "afp-1stpay-cibc-qr.png",
    alt: "AFP's 1st Pay QR code for CIBC customers",
  },
  other: {
    label: "I use another bank",
    hint: "Any other Barbados-dollar bank account",
    scheme: "1st Pay Plus",
    qr: qrPlus,
    file: "afp-1stpay-plus-qr.png",
    alt: "AFP's 1st Pay Plus QR code for customers of other banks",
  },
};

export function paymentSchemeFor(bank: PayerBank): string {
  return OPTIONS[bank].scheme;
}

function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Please type it in.");
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 border border-border rounded-xl px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] text-graphite uppercase tracking-wider">{label}</div>
        <div className="font-semibold text-base sm:text-lg tabular-nums break-all">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium border border-border rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function BankTransferSection({
  orderRef,
  totalLabel,
  totalPlain,
  paidHref,
}: {
  orderRef: string;
  /** Display amount, e.g. "BDS $145.00". */
  totalLabel: string;
  /** Amount as typed into a banking app, e.g. "145.00". */
  totalPlain: string;
  /** Builds the WhatsApp link for "I've paid", given the bank chosen. */
  paidHref: (bank: PayerBank) => string;
}) {
  const [bank, setBank] = useState<PayerBank | null>(null);
  const option = bank ? OPTIONS[bank] : null;

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 grid place-items-center bg-muted text-foreground">
          <QrCode className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <div className="font-medium">Pay now by bank QR code</div>
          <div className="text-sm text-graphite">
            Pay from your own banking app. No card needed.
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Which bank will you pay from?</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(OPTIONS) as PayerBank[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBank(key)}
              aria-pressed={bank === key}
              className={cn(
                "text-left rounded-xl border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                bank === key ? "border-foreground bg-muted" : "border-border hover:bg-muted/60",
              )}
            >
              <div className="font-medium text-sm">{OPTIONS[key].label}</div>
              <div className="text-xs text-graphite">{OPTIONS[key].hint}</div>
            </button>
          ))}
        </div>
      </fieldset>

      {option && bank && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_1fr] gap-4 items-start">
            <div>
              <img
                src={option.qr}
                alt={option.alt}
                className="w-full max-w-[260px] mx-auto rounded-xl border border-border bg-white"
              />
              <a
                href={option.qr}
                download={option.file}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-accent"
              >
                <Download className="w-3.5 h-3.5" /> Save this code to your phone
              </a>
            </div>

            <div className="space-y-2">
              <CopyRow label="Amount to send" value={totalLabel} copyValue={totalPlain} />
              <CopyRow label="Payment reference" value={orderRef} copyValue={orderRef} />
            </div>
          </div>

          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>
              Open your banking app and choose <span className="font-medium">{option.scheme}</span>,
              then scan the code. On this phone? Save the code above and upload it in your app.
            </li>
            <li>
              Enter the amount <span className="font-medium">{totalLabel}</span> exactly.
            </li>
            <li>
              Put <span className="font-medium">{orderRef}</span> in the reference or note, so we
              can match your payment.
            </li>
            <li>Come back here and press the button below to send us your order.</li>
          </ol>

          <a
            href={paidHref(bank)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="I've paid: send my order to AFP on WhatsApp (opens in a new tab)"
            className="w-full inline-flex items-center justify-center gap-2 px-6 h-12 eyebrow bg-ink text-bone hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            <MessageCircle aria-hidden="true" className="w-4 h-4" /> I've paid: send my order
          </a>

          <ul className="text-xs text-graphite space-y-1">
            <li>You send the payment yourself. This site never charges you or sees your bank details.</li>
            <li>
              We check every payment against our own bank record, then confirm your order on
              WhatsApp. No screenshot is needed.
            </li>
            <li>Please pay within 24 hours. After that an unpaid order is released.</li>
            <li>Sizes are limited: your items are secured once your payment is confirmed.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
