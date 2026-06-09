import * as React from "react";
import { Sparkles, Star } from "lucide-react";
import { shortAddr } from "../../contracts";
import type { OnchainAgent } from "../../lib/agents";
import { cn } from "../../lib/utils";

export function AgentPicker({
  agents,
  selectedOwner,
  onSelect,
  onManual,
}: {
  agents: OnchainAgent[];
  selectedOwner: string;
  onSelect: (owner: string) => void;
  onManual: (addr: string) => void;
}) {
  const [manual, setManual] = React.useState(false);
  const [manualAddr, setManualAddr] = React.useState("");

  const autoPick = () => {
    const best = [...agents].sort(
      (a, b) => (b.reputationScore ?? -1) - (a.reputationScore ?? -1)
    )[0];
    if (best) onSelect(best.owner);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Select a provider</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={autoPick}
            disabled={agents.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Auto-pick best
          </button>
          <button
            type="button"
            onClick={() => setManual((m) => !m)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
          >
            {manual ? "Pick from list" : "Enter address manually"}
          </button>
        </div>
      </div>

      {manual ? (
        <div className="flex gap-2">
          <input
            value={manualAddr}
            onChange={(e) => setManualAddr(e.target.value)}
            placeholder="0x…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none focus:border-brand/50"
          />
          <button
            type="button"
            onClick={() => onManual(manualAddr)}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Use
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          No other agents registered yet. Use manual entry to paste an address.
        </div>
      ) : (
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {agents.map((a) => {
            const isSel =
              selectedOwner.toLowerCase() === a.owner.toLowerCase();
            return (
              <button
                key={a.tokenId.toString()}
                type="button"
                onClick={() => onSelect(a.owner)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  isSel
                    ? "border-brand bg-brand/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand/30 to-info/20 text-lg">
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {a.metadata?.name ?? `Agent #${a.tokenId.toString()}`}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {shortAddr(a.owner)}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 text-warning" />
                  {a.reputationScore ?? "—"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
