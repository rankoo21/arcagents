import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function LifecycleStepper({
  steps,
  current,
}: {
  steps: string[];
  /** index of the active step; previous are done; later are idle. -1 = none */
  current: number;
}) {
  return (
    <ol className="flex w-full items-center gap-2" aria-label="Lifecycle">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                done && "bg-success text-black border-success",
                active && "bg-brand text-white border-brand glow-brand",
                !done &&
                  !active &&
                  "bg-white/5 text-muted-foreground border-white/10"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden truncate text-xs sm:inline",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  i < current ? "bg-success/50" : "bg-white/10"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
