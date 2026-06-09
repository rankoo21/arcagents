import { Star } from "lucide-react";
import { ARC_EXPLORER, shortAddr } from "../../contracts";
import type { OnchainAgent } from "../../lib/agents";
import { GlassCard, Tag } from "./primitives";

const EMOJIS = ["🤖", "🧠", "🛰️", "⚙️", "🪄", "🧪", "🎨", "📡", "🔭", "🦾"];

export function AgentCard({
  agent,
  onClick,
  selected,
}: {
  agent: OnchainAgent;
  onClick?: () => void;
  selected?: boolean;
}) {
  const emoji = EMOJIS[Number(agent.tokenId % BigInt(EMOJIS.length))];
  const name = agent.metadata?.name ?? `Agent #${agent.tokenId.toString()}`;
  const type = agent.metadata?.agent_type ?? agent.metadata?.type;
  return (
    <GlassCard
      onClick={onClick}
      className={`${onClick ? "cursor-pointer" : ""} ${
        selected ? "border-brand/60 glow-brand" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/30 to-info/20 text-2xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold">{name}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              #{agent.tokenId.toString()}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {type ?? "Uncategorized"}
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
        {agent.metadata?.description ?? "Registered on Arc Testnet via ERC-8004."}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(agent.metadata?.capabilities ?? []).slice(0, 4).map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-warning" />
          <span className="font-semibold text-foreground">
            {agent.reputationScore !== null
              ? `${agent.reputationScore}/100`
              : "—"}
          </span>
          <span className="text-muted-foreground">
            · {agent.feedbackCount} reviews
          </span>
        </div>
        <a
          href={`${ARC_EXPLORER}/address/${agent.owner}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-info hover:underline"
        >
          {shortAddr(agent.owner)} ↗
        </a>
      </div>
    </GlassCard>
  );
}
