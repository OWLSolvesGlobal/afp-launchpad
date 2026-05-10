import afpLogo from "@/assets/afp-logo.png";
import { cn } from "@/lib/utils";

interface LogoLoaderProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function LogoLoader({ label = "Loading", className, size = "md" }: LogoLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative">
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-safety/30 blur-xl animate-pulse",
            sizeMap[size],
          )}
          aria-hidden
        />
        <img
          src={afpLogo}
          alt=""
          aria-hidden
          className={cn(
            "relative object-contain animate-[logo-pulse_1.6s_ease-in-out_infinite]",
            sizeMap[size],
          )}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="eyebrow text-graphite tracking-[0.25em]">{label}</span>
        <span className="flex gap-1">
          <span className="h-1 w-1 rounded-full bg-safety animate-[dot-bounce_1s_ease-in-out_infinite]" />
          <span className="h-1 w-1 rounded-full bg-safety animate-[dot-bounce_1s_ease-in-out_0.15s_infinite]" />
          <span className="h-1 w-1 rounded-full bg-safety animate-[dot-bounce_1s_ease-in-out_0.3s_infinite]" />
        </span>
      </div>
    </div>
  );
}

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        className,
      )}
    />
  );
}