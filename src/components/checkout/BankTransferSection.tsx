import { useState } from "react";
import { Check, Copy, Download, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import qrCibc from "@/assets/qr-1stpay-cibc.png";

/**
 * Pay now with CIBC 1st Pay — rendered only when site-settings.json has
 * `paymentsTransferEnabled: true`.
 *
 * AFP is paid into its CIBC account by 1st Pay. Only CIBC customers can pay
 * this code. Customers of other banks order on WhatsApp and arrange payment
 * with the owner directly (the "1st Pay Plus" code for other banks did not
 * work when tested on 25 Nov 2026 and was removed).
 *
 * What this section does NOT do, by design:
 *  - It takes no payment itself. The customer sends the money from their own
 *    banking app; nothing is charged by this site.
 *  - A bank QR code cannot carry the amount or the order reference, so the
 *    customer types both. They are shown large, with copy buttons.
 *  - It never asks for, or accepts, a screenshot as proof. AFP confirms every
 *    payment against its own bank record (see CLAUDE.md).
 *
 * The code is drawn as large as the layout allows, on plain white, so a
 * second device can scan it straight off the screen. The image was redrawn
 * cleanly from the contents of the bank's own code (the bank's sign shows it
 * very small); it carries exactly the same data. If the bank ever issues a
 * new code, regenerate the image from that code and re-test with the app.
 */

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
  /** WhatsApp link for "I've paid", carrying the order and the reference. */
  paidHref: string;
}) {
  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 grid place-items-center bg-muted text-foreground">
          <QrCode className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <div className="font-medium">CIBC customers: pay now with 1st Pay</div>
          <div className="text-sm text-graphite">
            Scan with your CIBC app. CIBC Caribbean accounts only.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-border rounded-xl p-1 sm:p-5">
          <img
            src={qrCibc}
            alt="AFP's CIBC 1st Pay QR code"
            width={1140}
            height={1140}
            className="block w-full max-w-[460px] mx-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <a
          href={qrCibc}
          download="afp-cibc-1stpay-qr.png"
          className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-accent"
        >
          <Download className="w-3.5 h-3.5" /> Save this code to your phone
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CopyRow label="Amount to send" value={totalLabel} copyValue={totalPlain} />
          <CopyRow label="Payment reference" value={orderRef} copyValue={orderRef} />
        </div>

        <ol className="text-sm space-y-1.5 list-decimal pl-5">
          <li>
            Open your CIBC app, choose <span className="font-medium">1st Pay</span> and scan the
            code.
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
          href={paidHref}
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
        </ul>
      </div>
    </div>
  );
}
