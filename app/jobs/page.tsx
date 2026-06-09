"use client";
import { useEffect, useState, useCallback } from "react";
import { formatUnits, parseUnits, keccak256, toHex } from "viem";
import { Upload, Star, Check } from "lucide-react";
import { useWallet } from "../wallet-context";
import {
  publicClient,
  AGENTIC_COMMERCE,
  USDC_ADDRESS,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  agenticCommerceAbi,
  erc20Abi,
  identityAbi,
  reputationAbi,
  arcTestnet,
  JOB_STATUS_NAMES,
  USDC_DECIMALS,
  getLogWindow,
  ARC_EXPLORER,
  shortAddr,
  deliverableHashFromLink,
} from "../contracts";
import {
  GlassCard,
  StatCard,
  Spinner,
  EmptyState,
  InlineError,
  SkeletonCard,
} from "../components/ui/primitives";
import { StatusBadge } from "../components/ui/StatusBadge";
import { LifecycleStepper } from "../components/ui/LifecycleStepper";

interface OnchainJob {
  id: bigint;
  client: string;
  provider: string;
  evaluator: string;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: string;
}

const STEPS = ["Open", "Funded", "Submitted", "Completed"];

export default function JobsPage() {
  const { address, walletClient, refreshBalance } = useWallet();
  const [jobs, setJobs] = useState<OnchainJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [deliverables, setDeliverables] = useState<Record<string, string>>({});
  const [verifyInputs, setVerifyInputs] = useState<Record<string, string>>({});
  const [verifyResults, setVerifyResults] = useState<
    Record<string, "match" | "mismatch">
  >({});
  const [ratedJobs, setRatedJobs] = useState<Set<string>>(new Set());

  const [submitModal, setSubmitModal] = useState<{
    job: OnchainJob;
    link: string;
  } | null>(null);
  const [rating, setRating] = useState<{
    job: OnchainJob;
    score: number;
    comment: string;
  } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setJobs(null);
    try {
      const { fromBlock, toBlock } = await getLogWindow();

      const logs = await publicClient.getLogs({
        address: AGENTIC_COMMERCE,
        event: agenticCommerceAbi[6],
        fromBlock,
        toBlock,
      });
      const submittedLogs = await publicClient.getLogs({
        address: AGENTIC_COMMERCE,
        event: agenticCommerceAbi[7],
        fromBlock,
        toBlock,
      });
      const dMap: Record<string, string> = {};
      for (const log of submittedLogs) {
        const a = log.args as { jobId?: bigint; deliverable?: string };
        if (a.jobId !== undefined && a.deliverable)
          dMap[a.jobId.toString()] = a.deliverable;
      }

      const seen = new Set<string>();
      const ids: bigint[] = [];
      for (let i = logs.length - 1; i >= 0 && ids.length < 18; i--) {
        const jid = logs[i].args.jobId!;
        if (!seen.has(jid.toString())) {
          seen.add(jid.toString());
          ids.push(jid);
        }
      }
      const results: OnchainJob[] = [];
      for (const jobId of ids) {
        try {
          const job = (await publicClient.readContract({
            address: AGENTIC_COMMERCE,
            abi: agenticCommerceAbi,
            functionName: "getJob",
            args: [jobId],
          })) as OnchainJob;
          results.push(job);
        } catch {
          /* skip */
        }
      }
      setJobs(results);
      setDeliverables(dMap);
    } catch (err) {
      console.error(err);
      setError("Could not read jobs from Arc Testnet.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const role = useCallback(
    (job: OnchainJob): "client" | "provider" | "evaluator" | null => {
      if (!address) return null;
      const a = address.toLowerCase();
      if (job.provider.toLowerCase() === a) return "provider";
      if (job.evaluator.toLowerCase() === a) return "evaluator";
      if (job.client.toLowerCase() === a) return "client";
      return null;
    },
    [address]
  );

  const runTx = useCallback(
    async (key: string, fn: () => Promise<`0x${string}`>) => {
      if (!walletClient || !address) {
        setActionError("Connect your wallet first.");
        return false;
      }
      setActionError(null);
      setBusy(key);
      try {
        const hash = await fn();
        await publicClient.waitForTransactionReceipt({ hash });
        await refreshBalance();
        await load();
        return true;
      } catch (err: unknown) {
        const e = err as { shortMessage?: string; message?: string };
        setActionError(e.shortMessage || e.message || "Transaction failed");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [walletClient, address, refreshBalance, load]
  );

  const handleSetBudget = (job: OnchainJob) => {
    const amount = parseFloat(budgetInputs[job.id.toString()] || "0");
    if (!amount || amount <= 0) {
      setActionError("Enter a budget amount in USDC.");
      return;
    }
    const value = parseUnits(amount.toString(), USDC_DECIMALS);
    runTx(`budget-${job.id}`, () =>
      walletClient!.writeContract({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "setBudget",
        args: [job.id, value, "0x"],
        chain: arcTestnet,
        account: address!,
      })
    );
  };

  const handleFund = (job: OnchainJob) =>
    runTx(`fund-${job.id}`, async () => {
      const approveHash = await walletClient!.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [AGENTIC_COMMERCE, job.budget],
        chain: arcTestnet,
        account: address!,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      return walletClient!.writeContract({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "fund",
        args: [job.id, "0x"],
        chain: arcTestnet,
        account: address!,
      });
    });

  const handleComplete = (job: OnchainJob) =>
    runTx(`complete-${job.id}`, () =>
      walletClient!.writeContract({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "complete",
        args: [job.id, keccak256(toHex("deliverable-approved")), "0x"],
        chain: arcTestnet,
        account: address!,
      })
    );

  const doSubmit = async () => {
    if (!submitModal || !walletClient || !address) return;
    if (!submitModal.link.trim()) {
      setActionError("Enter a deliverable link.");
      return;
    }
    setModalBusy(true);
    try {
      const hash = await walletClient.writeContract({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "submit",
        args: [submitModal.job.id, deliverableHashFromLink(submitModal.link), "0x"],
        chain: arcTestnet,
        account: address,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setSubmitModal(null);
      await load();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setActionError(e.shortMessage || e.message || "Submit failed");
    } finally {
      setModalBusy(false);
    }
  };

  const findAgentId = async (providerAddr: string): Promise<bigint | null> => {
    const { fromBlock, toBlock } = await getLogWindow();
    const transferLogs = await publicClient.getLogs({
      address: IDENTITY_REGISTRY,
      event: identityAbi[3],
      fromBlock,
      toBlock,
    });
    const mints = transferLogs.filter(
      (l) => l.args.from === "0x0000000000000000000000000000000000000000"
    );
    for (let i = mints.length - 1; i >= 0; i--) {
      const tokenId = mints[i].args.tokenId!;
      try {
        const owner = (await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: identityAbi,
          functionName: "ownerOf",
          args: [tokenId],
        })) as string;
        if (owner.toLowerCase() === providerAddr.toLowerCase()) return tokenId;
      } catch {
        /* skip */
      }
    }
    return null;
  };

  const doRate = async () => {
    if (!rating || !walletClient || !address) return;
    setModalBusy(true);
    setActionError(null);
    try {
      const agentId = await findAgentId(rating.job.provider);
      if (agentId === null)
        throw new Error("Provider has no registered ERC-8004 agent.");
      const tag = "quality";
      const fHash = keccak256(
        toHex(`job-${rating.job.id.toString()}-${tag}-${rating.score}`)
      );
      const hash = await walletClient.writeContract({
        address: REPUTATION_REGISTRY,
        abi: reputationAbi,
        functionName: "giveFeedback",
        args: [agentId, BigInt(rating.score), 0, tag, "", "", rating.comment, fHash],
        chain: arcTestnet,
        account: address,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setRatedJobs((prev) => new Set(prev).add(rating.job.id.toString()));
      setRating(null);
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setActionError(e.shortMessage || e.message || "Feedback failed");
    } finally {
      setModalBusy(false);
    }
  };

  const stats = jobs
    ? {
        total: jobs.length,
        funded: jobs.filter((j) => j.status === 1).length,
        completed: jobs.filter((j) => j.status === 3).length,
        escrow: jobs.reduce(
          (s, j) =>
            s + (j.status < 3 ? Number(formatUnits(j.budget, USDC_DECIMALS)) : 0),
          0
        ),
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Job Board</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ERC-8183 job contracts with USDC escrow on Arc Testnet.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recent Jobs" value={stats?.total ?? "—"} accent="brand" />
        <StatCard label="Funded" value={stats?.funded ?? "—"} accent="info" />
        <StatCard
          label="Completed"
          value={stats?.completed ?? "—"}
          accent="success"
        />
        <StatCard
          label="Escrow Locked"
          value={stats ? `${stats.escrow.toFixed(2)} USDC` : "—"}
          accent="warning"
        />
      </div>

      {actionError && (
        <div className="mb-6">
          <InlineError message={actionError} />
        </div>
      )}

      {error ? (
        <InlineError message={error} onRetry={load} />
      ) : !jobs ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Post the first job and fund it with USDC escrow."
          action={
            <a
              href="/create-job"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Create a Job
            </a>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => {
            const id = job.id.toString();
            const r = role(job);
            const onchainHash = deliverables[id];
            return (
              <GlassCard key={id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Job #{id}</h3>
                      <StatusBadge status={job.status} kind="job" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r ? `You: ${r}` : "Onchain"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Budget</div>
                    <div className="font-semibold text-success">
                      {job.budget === 0n
                        ? "Not set"
                        : `${formatUnits(job.budget, USDC_DECIMALS)} USDC`}
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {job.description || "No description"}
                </p>

                <div className="mt-4">
                  <LifecycleStepper steps={STEPS} current={job.status} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
                  <span>Client {shortAddr(job.client)}</span>
                  <span>Provider {shortAddr(job.provider)}</span>
                </div>

                {/* Actions */}
                <div className="mt-4">{renderActions(job, r, id)}</div>

                {/* Deliverable verify */}
                {onchainHash && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Deliverable hash (onchain)</span>
                      <code className="rounded bg-white/5 px-2 py-0.5 text-info">
                        {onchainHash.slice(0, 10)}…{onchainHash.slice(-6)}
                      </code>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        placeholder="Paste link to verify"
                        value={verifyInputs[id] ?? ""}
                        onChange={(e) =>
                          setVerifyInputs((p) => ({ ...p, [id]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-brand/50"
                      />
                      <button
                        onClick={() => {
                          const computed = deliverableHashFromLink(
                            verifyInputs[id] ?? ""
                          );
                          setVerifyResults((p) => ({
                            ...p,
                            [id]:
                              computed.toLowerCase() ===
                              onchainHash.toLowerCase()
                                ? "match"
                                : "mismatch",
                          }));
                        }}
                        disabled={!(verifyInputs[id] ?? "").trim()}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                    {verifyResults[id] === "match" && (
                      <p className="mt-2 text-xs text-success">
                        ✅ Match — this is exactly what was submitted onchain.
                      </p>
                    )}
                    {verifyResults[id] === "mismatch" && (
                      <p className="mt-2 text-xs text-danger">
                        ❌ Mismatch — does not match the onchain deliverable.
                      </p>
                    )}
                  </div>
                )}

                <a
                  href={`${ARC_EXPLORER}/address/${AGENTIC_COMMERCE}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-info hover:underline"
                >
                  View contract ↗
                </a>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Submit modal */}
      {submitModal && (
        <Modal onClose={() => !modalBusy && setSubmitModal(null)}>
          <h2 className="text-lg font-semibold">
            Submit — Job #{submitModal.job.id.toString()}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste the link to your finished work. Its hash is recorded onchain.
          </p>
          <input
            placeholder="ipfs://… or https://…"
            value={submitModal.link}
            onChange={(e) =>
              setSubmitModal({ ...submitModal, link: e.target.value })
            }
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setSubmitModal(null)}
              disabled={modalBusy}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={doSubmit}
              disabled={modalBusy || !submitModal.link.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {modalBusy ? <Spinner /> : <Upload className="h-4 w-4" />}
              Submit Onchain
            </button>
          </div>
        </Modal>
      )}

      {/* Rate modal */}
      {rating && (
        <Modal onClose={() => !modalBusy && setRating(null)}>
          <h2 className="text-lg font-semibold">Rate Provider</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Job #{rating.job.id.toString()} · {shortAddr(rating.job.provider)}
          </p>
          <div className="mt-4">
            <label className="text-xs text-muted-foreground">
              Score: {rating.score}/100
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={rating.score}
              onChange={(e) =>
                setRating({ ...rating, score: parseInt(e.target.value) })
              }
              className="mt-2 w-full accent-[color:var(--brand)]"
            />
          </div>
          <textarea
            placeholder="Comment (optional)"
            value={rating.comment}
            onChange={(e) => setRating({ ...rating, comment: e.target.value })}
            rows={3}
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setRating(null)}
              disabled={modalBusy}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={doRate}
              disabled={modalBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {modalBusy ? <Spinner /> : <Star className="h-4 w-4" />}
              Submit Feedback
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  function renderActions(
    job: OnchainJob,
    r: "client" | "provider" | "evaluator" | null,
    id: string
  ) {
    const isBusy = (k: string) => busy === k;
    if (!address)
      return (
        <p className="text-xs text-muted-foreground">
          Connect your wallet to act on this job.
        </p>
      );
    if (!r)
      return (
        <p className="text-xs text-muted-foreground">
          You are not a participant in this job.
        </p>
      );

    if (job.status === 0) {
      if (r === "provider" && job.budget === 0n)
        return (
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Budget (USDC)"
              value={budgetInputs[id] ?? ""}
              onChange={(e) =>
                setBudgetInputs((p) => ({ ...p, [id]: e.target.value }))
              }
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <button
              onClick={() => handleSetBudget(job)}
              disabled={isBusy(`budget-${job.id}`)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {isBusy(`budget-${job.id}`) ? <Spinner /> : "Set Budget"}
            </button>
          </div>
        );
      if (r === "client")
        return job.budget === 0n ? (
          <p className="text-xs text-muted-foreground">
            Waiting for the provider to set a budget.
          </p>
        ) : (
          <button
            onClick={() => handleFund(job)}
            disabled={isBusy(`fund-${job.id}`)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {isBusy(`fund-${job.id}`) ? <Spinner /> : null}
            Approve & Fund {formatUnits(job.budget, USDC_DECIMALS)} USDC
          </button>
        );
      return (
        <p className="text-xs text-muted-foreground">
          {job.budget === 0n
            ? "Awaiting budget from provider."
            : "Awaiting funding from client."}
        </p>
      );
    }

    if (job.status === 1) {
      if (r === "provider")
        return (
          <button
            onClick={() => setSubmitModal({ job, link: "" })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            <Upload className="h-4 w-4" /> Submit Deliverable
          </button>
        );
      return (
        <p className="text-xs text-muted-foreground">
          Escrow funded. Waiting for the provider to submit.
        </p>
      );
    }

    if (job.status === 2) {
      if (r === "evaluator" || r === "client")
        return (
          <button
            onClick={() => handleComplete(job)}
            disabled={isBusy(`complete-${job.id}`)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {isBusy(`complete-${job.id}`) ? <Spinner /> : null}
            Approve & Release Escrow
          </button>
        );
      return (
        <p className="text-xs text-muted-foreground">
          Deliverable submitted. Waiting for evaluator approval.
        </p>
      );
    }

    if (job.status === 3) {
      const rated = ratedJobs.has(id);
      if ((r === "client" || r === "evaluator") && !rated)
        return (
          <button
            onClick={() => setRating({ job, score: 90, comment: "" })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            <Star className="h-4 w-4 text-warning" /> Rate Provider
          </button>
        );
      return (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> Completed — escrow released
          {rated ? " · rated" : ""}.
        </p>
      );
    }

    return (
      <p className="text-xs text-muted-foreground">
        Status: {JOB_STATUS_NAMES[job.status] || "Unknown"}
      </p>
    );
  }
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
