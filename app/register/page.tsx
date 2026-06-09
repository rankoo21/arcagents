"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "../wallet-context";
import {
  IDENTITY_REGISTRY,
  identityAbi,
  publicClient,
  arcTestnet,
  ARC_EXPLORER,
} from "../contracts";
import { GlassCard, Spinner, SuccessPanel } from "../components/ui/primitives";

const TYPES = [
  "trading",
  "moderation",
  "security",
  "oracle",
  "creative",
  "finance",
  "other",
];

export default function RegisterPage() {
  const { address, walletClient, connect, isConnecting } = useWallet();
  const [form, setForm] = useState({
    name: "",
    description: "",
    agentType: "trading",
    capabilities: "",
  });
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <GlassCard>
          <Wallet className="mx-auto h-10 w-10 text-brand" />
          <h2 className="mt-3 text-xl font-semibold">
            Connect wallet to register
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You need a connected wallet on Arc Testnet to mint an agent
            identity.
          </p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {isConnecting ? <Spinner /> : <Wallet className="h-4 w-4" />} Connect
            Wallet
          </button>
        </GlassCard>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <SuccessPanel title="Agent registered!" txHash={txHash}>
          <p className="mt-1 text-sm text-muted-foreground">
            Your agent &quot;{form.name}&quot; identity is now on-chain via
            ERC-8004.
          </p>
        </SuccessPanel>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletClient) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const metadata = {
        name: form.name,
        description: form.description,
        agent_type: form.agentType,
        capabilities: form.capabilities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        version: "1.0.0",
        registeredAt: new Date().toISOString(),
        registeredBy: address,
      };
      const metadataURI = `data:application/json;base64,${btoa(
        JSON.stringify(metadata)
      )}`;

      const hash = await walletClient.writeContract({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: "register",
        args: [metadataURI],
        chain: arcTestnet,
        account: address,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setErrorMsg(e.shortMessage || e.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Register Agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mint an ERC-8004 identity for your autonomous agent on Arc Testnet.
      </p>

      <GlassCard className="mt-6">
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {errorMsg}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. DeFi Arbitrage Agent v1.0"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              required
              placeholder="What does your agent do?"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={form.agentType}
              onChange={(e) => setForm({ ...form, agentType: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Capabilities (comma-separated)
            </label>
            <input
              value={form.capabilities}
              onChange={(e) =>
                setForm({ ...form, capabilities: e.target.value })
              }
              placeholder="arbitrage_detection, liquidity_monitoring"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,92,231,0.7)] hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Registering on Arc…" : "Register Agent"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
