import * as React from "react";
import { cn } from "../../lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "brand" | "info";
}) {
  const tones: Record<string, string> = {
    default: "bg-white/5 text-foreground/80 border-white/10",
    brand: "bg-brand/15 text-brand border-brand/30",
    info: "bg-info/15 text-info border-info/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 transition-all hover:border-white/15 hover:shadow-[0_10px_40px_-10px_rgba(108,92,231,0.35)]",
        className
      )}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "brand" | "success" | "info" | "warning";
}) {
  const accents: Record<string, string> = {
    brand: "from-brand/30",
    success: "from-success/30",
    info: "from-info/30",
    warning: "from-warning/30",
  };
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div
        className={cn(
          "absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl",
          accent ? accents[accent] : "from-brand/20"
        )}
      />
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-2xl p-12 text-center">
      <div className="text-4xl">🛰️</div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" />
      <div className="flex-1">
        <div className="font-medium text-danger">Something went wrong</div>
        <div className="text-muted-foreground">{message}</div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/5"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="glass animate-pulse rounded-2xl p-5">
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="mt-3 h-6 w-2/3 rounded bg-white/10" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-5/6 rounded bg-white/5" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-white/10" />
        <div className="h-5 w-14 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function SuccessPanel({
  title,
  txHash,
  children,
}: {
  title: string;
  txHash?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl border-success/30 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-2xl">
        ✓
      </div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      {children}
      {txHash && (
        <a
          href={`https://testnet.arcscan.app/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block break-all text-xs text-info hover:underline"
        >
          {txHash.slice(0, 14)}…{txHash.slice(-10)} ↗
        </a>
      )}
    </div>
  );
}
