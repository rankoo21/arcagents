"use client";
import { useState, useEffect, useCallback } from "react";
import { parseUnits, decodeEventLog, isAddress, type Address } from "viem";
import { Check, Wallet } from "lucide-react";
import { useWallet } from "../wallet-context";
import {
  AGENTIC_COMMERCE,
  USDC_ADDRESS,
  agenticCommerceAbi,
  erc20Abi,
  publicClient,
  arcTestnet,
  USDC_DECIMALS,
} from "../contracts";
import { fetchOnchainAgents, type OnchainAgent } from "../lib/agents";
import { AgentPicker } from "../components/ui/AgentPicker";
import { GlassCard, Spinner, SuccessPanel } from "../components/ui/primitives";
import { LifecycleStepper } from "../components/ui/LifecycleStepper";

const ZERO: Address = "0x0000000000000000000000000000000000000000";
const STEPS = ["Open", "Funded", "Submitted", "Completed"];

type StepState = { label: string; state: "idle" | "busy" | "done" };

export default function CreateJobPage() {
  const { address, walletClient, connect, isConnecting, refreshBalance } =
    useWallet();
  const [agents, setAgents] = useState<OnchainAgent[]>([]);
  const [provider, setProvider] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState("7");
  const [fundNow, setFundNow] = useState(true);

  const [steps, setSteps] = useState<StepState[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    jobId: string;
    txHash: string;
    escrow: string;
    funded: boolean;
  } | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const list = await fetchOnchainAgents(24);
      setAgents(
        list.filter((a) => a.owner.toLowerCase() !== address?.toLowerCase())
      );
    } catch {
      setAgents([]);
    }
  }, [address]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <GlassCard>
          <Wallet className="mx-auto h-10 w-10 text-brand" />
          <h2 className="mt-3 text-xl font-semibold">
            Connect wallet to create a job
          </h2>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            {isConnecting ? <Spinner /> : <Wallet className="h-4 w-4" />} Connect
            Wallet
          </button>
        </GlassCard>
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <SuccessPanel
          title={result.funded ? "Job created & funded!" : "Job created!"}
          txHash={result.txHash}
        >
          <div className="mt-3 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Job ID</div>
              <div className="font-semibold">#{result.jobId}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Escrow</div>
              <div className="font-semibold text-success">
                {result.funded ? `${result.escrow} USDC` : "Not funded"}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <LifecycleStepper steps={STEPS} current={result.funded ? 1 : 0} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <a
              href="/jobs"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Go to Job Board
            </a>
            <button
              onClick={() => {
                setResult(null);
                setSteps([]);
                setDesc("");
                setBudget("");
                setProvider("");
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Create Another
            </button>
          </div>
        </SuccessPanel>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!walletClient) return;
    if (!isAddress(provider)) {
      setErrorMsg("Select a provider or enter a valid address.");
      return;
    }
    if (provider.toLowerCase() === address.toLowerCase()) {
      setErrorMsg("Provider must differ from your (client) address.");
      return;
    }
    const amount = parseFloat(budget);
    if (fundNow && (!amount || amount <= 0)) {
      setErrorMsg("Enter a budget greater than 0 to fund escrow.");
      return;
    }

    const flow: StepState[] = [{ label: "Creating job", state: "idle" }];
    if (fundNow) {
      flow.push({ label: "Setting budget", state: "idle" });
      flow.push({ label: "Approving USDC", state: "idle" });
      flow.push({ label: "Funding escrow", state: "idle" });
    }
    setSteps(flow);
    setBusy(true);

    const mark = (i: number, state: StepState["state"]) =>
      setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, state } : s)));

    try {
      const expiredAt = BigInt(
        Math.floor(Date.now() / 1000) + parseInt(duration) * 86400
      );
      const value = fundNow
        ? parseUnits(amount.toString(), USDC_DECIMALS)
        : 0n;

      // 1. createJob
      mark(0, "busy");
      const createHash = await walletClient.writeContract({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "createJob",
        args: [provider as Address, address, expiredAt, desc, ZERO],
        chain: arcTestnet,
        account: address,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: createHash,
      });
      let jobId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: agenticCommerceAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "JobCreated") {
            jobId = (decoded.args as { jobId: bigint }).jobId;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (jobId === null) throw new Error("Could not parse JobCreated event.");
      mark(0, "done");

      let lastTx = createHash;

      if (fundNow) {
        // 2. setBudget
        mark(1, "busy");
        const bHash = await walletClient.writeContract({
          address: AGENTIC_COMMERCE,
          abi: agenticCommerceAbi,
          functionName: "setBudget",
          args: [jobId, value, "0x"],
          chain: arcTestnet,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: bHash });
        mark(1, "done");

        // 3. approve
        mark(2, "busy");
        const aHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [AGENTIC_COMMERCE, value],
          chain: arcTestnet,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: aHash });
        mark(2, "done");

        // 4. fund
        mark(3, "busy");
        const fHash = await walletClient.writeContract({
          address: AGENTIC_COMMERCE,
          abi: agenticCommerceAbi,
          functionName: "fund",
          args: [jobId, "0x"],
          chain: arcTestnet,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: fHash });
        mark(3, "done");
        lastTx = fHash;
      }

      await refreshBalance();
      setResult({
        jobId: jobId.toString(),
        txHash: lastTx,
        escrow: amount ? amount.toFixed(2) : "0",
        funded: fundNow,
      });
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setErrorMsg(e.shortMessage || e.message || "Job creation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Create Job</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ERC-8183 — fixed provider, USDC escrow on Arc Testnet.
      </p>

      <GlassCard className="mt-6">
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {errorMsg}
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Describe the task for the AI agent…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>

          <AgentPicker
            agents={agents}
            selectedOwner={provider}
            onSelect={setProvider}
            onManual={setProvider}
          />
          {provider && (
            <div className="rounded-lg border border-brand/30 bg-brand/10 p-2 text-xs">
              Provider: <span className="font-mono">{provider}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">
                Budget (USDC)
              </label>
              <input
                required={fundNow}
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 5.00"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Duration: {duration} days
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-3 w-full accent-[color:var(--brand)]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fundNow}
              onChange={(e) => setFundNow(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--brand)]"
            />
            Fund escrow now (setBudget → approve → fund)
          </label>

          {steps.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {s.state === "done" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : s.state === "busy" ? (
                    <Spinner />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-white/15" />
                  )}
                  <span
                    className={s.state === "done" ? "text-muted-foreground" : ""}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !provider}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,92,231,0.7)] hover:bg-brand/90 disabled:opacity-60"
          >
            {busy && <Spinner />}
            {busy
              ? "Processing…"
              : fundNow
              ? "Create & Fund Job"
              : "Create Job"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
