"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { fetchOnchainAgents, type OnchainAgent } from "../lib/agents";
import { AgentCard } from "../components/ui/AgentCard";
import {
  EmptyState,
  InlineError,
  SkeletonCard,
  StatCard,
} from "../components/ui/primitives";

export default function AgentsPage() {
  const [data, setData] = useState<OnchainAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"rep" | "feedback" | "id">("rep");

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      setData(await fetchOnchainAgents(24));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const types = useMemo(() => {
    const s = new Set<string>();
    data?.forEach((a) => {
      const t = a.metadata?.agent_type ?? a.metadata?.type;
      if (t) s.add(t);
    });
    return Array.from(s);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return null;
    let list = data;
    if (q)
      list = list.filter((a) =>
        (a.metadata?.name ?? "").toLowerCase().includes(q.toLowerCase())
      );
    if (type)
      list = list.filter(
        (a) => (a.metadata?.agent_type ?? a.metadata?.type) === type
      );
    list = [...list].sort((a, b) => {
      if (sort === "rep")
        return (b.reputationScore ?? -1) - (a.reputationScore ?? -1);
      if (sort === "feedback") return b.feedbackCount - a.feedbackCount;
      return Number(a.tokenId - b.tokenId);
    });
    return list;
  }, [data, q, type, sort]);

  const stats = useMemo(() => {
    if (!data) return null;
    const withRep = data.filter((a) => a.reputationScore !== null);
    const avg = withRep.length
      ? Math.round(
          withRep.reduce((s, a) => s + (a.reputationScore ?? 0), 0) /
            withRep.length
        )
      : 0;
    return { total: data.length, withRep: withRep.length, avg };
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Autonomous AI agents registered on Arc Network via ERC-8004.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Agents" value={stats?.total ?? "—"} accent="brand" />
        <StatCard
          label="With Reputation"
          value={stats?.withRep ?? "—"}
          accent="info"
        />
        <StatCard
          label="Avg Reputation"
          value={stats ? `${stats.avg}/100` : "—"}
          accent="success"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand/50"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand/50"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "rep" | "feedback" | "id")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand/50"
        >
          <option value="rep">Sort: Reputation</option>
          <option value="feedback">Sort: Feedback</option>
          <option value="id">Sort: Token ID</option>
        </select>
      </div>

      {error ? (
        <InlineError message={error} onRetry={load} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !filtered?.length ? (
        <EmptyState
          title="No agents found"
          description="Be the first to register an AI agent onchain, or clear your filters."
          action={
            <a
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Register an Agent
            </a>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={a.tokenId.toString()} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}
