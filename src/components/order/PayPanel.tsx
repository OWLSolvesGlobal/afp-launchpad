import { Download } from "lucide-react";
import qrCibc from "@/assets/qr-1stpay-cibc.png";
import { cn } from "@/lib/utils";
import type { BankDetails, PaymentMethod } from "@/lib/orders-core";
import { CopyRow } from "./CopyRow";

/**
 * How to pay. The site takes no payment itself: the customer sends the money
 * from their own banking app, then uploads proof on the next step.
 *
 * A bank QR code cannot carry the amount or the order reference, so both are
 * shown large with copy buttons. The code is drawn as large as the layout
 * allows, on plain white, so a second device can scan it off the screen.
 *
 * Bank transfer appears only when the owner has entered AFP's bank details
 * (they arrive with the order, for this customer only). It is never shown blank.
 */
export function PayPanel({
  orderRef,
  totalLabel,
  totalPlain,
  cibcEnabled,
  bank,
  method,
  onMethod,
}: {
  orderRef: string;
  /** Display amount, e.g. "BDS $145.00". */
  totalLabel: string;
  /** Amount as typed into a banking app, e.g. "145.00". */
  totalPlain: string;
  cibcEnabled: boolean;
  bank: BankDetails | null;
  method: PaymentMethod;
  onMethod: (m: PaymentMethod) => void;
}) {
  const both = cibcEnabled && Boolean(bank);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CopyRow label="Amount to send" value={totalLabel} copyValue={totalPlain} />
        <CopyRow label="Payment reference" value={orderRef} />
      </div>

      {both && (
        <div role="radiogroup" aria-label="How would you like to pay?" className="grid grid-cols-2 gap-2">
          {(
            [
              ["cibc_qr", "CIBC 1st Pay", "Scan a code in your CIBC app"],
              ["bank_transfer", "Bank transfer", "From any bank"],
            ] as const
          ).map(([id, title, sub]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={method === id}
              onClick={() => onMethod(id)}
              className={cn(
                "text-left border rounded-2xl p-4 min-h-[72px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                method === id ? "border-foreground bg-foreground/[0.02]" : "border-border hover:border-foreground/40",
              )}
            >
              <div className="font-medium">{title}</div>
              <div className="text-sm text-graphite">{sub}</div>
            </button>
          ))}
        </div>
      )}

      {method === "cibc_qr" && cibcEnabled && (
        <section aria-labelledby="pay-cibc" className="space-y-4">
          <div>
            <h3 id="pay-cibc" className="font-medium">
              Pay with CIBC 1st Pay
            </h3>
            <p className="text-sm text-graphite">CIBC Caribbean accounts only.</p>
          </div>
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
            className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium underline underline-offset-4 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Save this code to your phone
          </a>
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>
              Open your CIBC app, choose <span className="font-medium">1st Pay</span> and scan the code.
            </li>
            <li>
              Enter the amount <span className="font-medium">{totalLabel}</span> exactly.
            </li>
            <li>
              Put <span className="font-medium">{orderRef}</span> in the reference or note, so we can match your
              payment.
            </li>
            <li>Take a screenshot of the confirmation. You'll upload it on the next step.</li>
          </ol>
        </section>
      )}

      {method === "bank_transfer" && bank && (
        <section aria-labelledby="pay-bank" className="space-y-4">
          <div>
            <h3 id="pay-bank" className="font-medium">
              Pay by bank transfer
            </h3>
            <p className="text-sm text-graphite">Send from your online banking to the account below.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <CopyRow label="Bank" value={bank.bank} />
            <CopyRow label="Account name" value={bank.accountName} />
            <CopyRow label="Account number" value={bank.accountNumber} />
            {bank.branch && <CopyRow label="Branch" value={bank.branch} />}
            {bank.swift && <CopyRow label="SWIFT code" value={bank.swift} />}
          </div>
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>
              Send <span className="font-medium">{totalLabel}</span> exactly.
            </li>
            <li>
              Put <span className="font-medium">{orderRef}</span> in the reference or note, so we can match your
              payment.
            </li>
            <li>Save the confirmation as a screenshot or PDF. You'll upload it on the next step.</li>
          </ol>
        </section>
      )}

      <p className="text-xs text-graphite">
        You send the payment yourself. This site never charges you or sees your bank login.
      </p>
    </div>
  );
}
