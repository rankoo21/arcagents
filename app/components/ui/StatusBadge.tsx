import { cn } from "../../lib/utils";

const JOB_STATUS = [
  "Open",
  "Funded",
  "Submitted",
  "Completed",
  "Rejected",
  "Expired",
];
const MARKET_STATUS = ["Open", "Assigned", "Submitted", "Completed", "Cancelled"];

const TONE: Record<string, string> = {
  Open: "bg-info/15 text-info border-info/30",
  Funded: "bg-brand/15 text-brand border-brand/30",
  Assigned: "bg-brand/15 text-brand border-brand/30",
  Submitted: "bg-warning/15 text-warning border-warning/30",
  Completed: "bg-success/15 text-success border-success/30",
  Rejected: "bg-danger/15 text-danger border-danger/30",
  Cancelled: "bg-danger/15 text-danger border-danger/30",
  Expired: "bg-muted-foreground/15 text-muted-foreground border-white/10",
};

export function StatusBadge({
  status,
  kind = "job",
}: {
  status: number;
  kind?: "job" | "market";
}) {
  const label =
    (kind === "market" ? MARKET_STATUS : JOB_STATUS)[status] ?? "Unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE[label] ?? TONE.Open
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
