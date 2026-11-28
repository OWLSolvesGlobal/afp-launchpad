import { useEffect, useRef, useState } from "react";

/**
 * Time left to pay. Counts down to the server's `expiresAt` using the
 * server's clock (this device's clock plus the offset measured when the
 * order was fetched), so a wrong phone clock cannot show the wrong time.
 *
 * The ticking digits are hidden from screen readers; a separate polite
 * message is announced only at 10, 5 and 1 minutes left.
 */
export function Countdown({
  expiresAt,
  clockOffsetMs,
  onExpire,
}: {
  expiresAt: string;
  clockOffsetMs: number;
  onExpire: () => void;
}) {
  const end = Date.parse(expiresAt);
  const left = () => Math.max(0, end - (Date.now() + clockOffsetMs));
  const [ms, setMs] = useState(left);
  const fired = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef<number | null>(null);

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const now = Math.max(0, end - (Date.now() + clockOffsetMs));
      setMs(now);
      const minutes = Math.ceil(now / 60_000);
      if ([10, 5, 1].includes(minutes) && announced.current !== minutes && now > 0) {
        announced.current = minutes;
        setAnnouncement(`${minutes} ${minutes === 1 ? "minute" : "minutes"} left to send your proof of payment.`);
      }
      if (now <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end, clockOffsetMs, onExpire]);

  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const urgent = ms <= 10 * 60_000;
  // An order the shop reopened is held for hours, not minutes.
  const long = totalSeconds >= 100 * 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);

  return (
    <div className="flex items-center justify-between gap-4 border border-border rounded-2xl px-5 py-4 bg-card">
      <div>
        <div className="eyebrow text-graphite">Your items are held for</div>
        <p className="text-sm text-graphite mt-1">
          Pay and send your proof before the time runs out, or the items go back on sale.
        </p>
      </div>
      {/* Fixed width so the digits never shift the layout. */}
      <div
        aria-hidden="true"
        className={`font-serif tabular-nums shrink-0 text-right ${long ? "text-2xl" : "text-4xl w-[5.5ch]"} ${urgent ? "text-accent" : ""}`}
      >
        {long ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mm}:${ss}`}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
