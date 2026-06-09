"use client";
import { useEffect, useState, useCallback } from "react";
import { formatUnits, parseUnits, isAddress } from "viem";
import { Plus, Upload, Check, Star } from "lucide-react";
import { useWallet } from "../wallet-context";
import {
  publicClient,
  AGENT_JOB_MARKET,
  USDC_ADDRESS,
  jobMarketAbi,
  erc20Abi,
  arcTestnet,
  USDC_DECIMALS,
  ARC_EXPLORER,
  shortAddr,
  deliverableHashFromLink,
} from "../contracts";
import {
  fetchMarketJobs,
  fetchApplications,
  type MarketJob,
  type MarketApplication,
} from "../lib/market";
import {
  GlassCard,
  StatCard,
  Spinner,
  EmptyState,
  InlineError,
  SkeletonCard,
} from "../components/ui/primitives";
import { StatusBadge } from "../components/ui/StatusBadge";

export default function MarketplacePage() {
  const { address, walletClient, refreshBalance } = useWallet();
  const [jobs, setJobs] = useState<MarketJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showPost, setShowPost] = useState(false);
  const [postForm, setPostForm] = useState({
    description: "",
    budget: "",
    duration: "7",
  });

  const [apps, setApps] = useState<Record<string, MarketApplication[]>>({});
  const [openApps, setOpenApps] = useState<string | null>(null);
  const [applyModal, setApplyModal] = useState<{
    job: MarketJob;
    price: string;
    proposal: string;
  } | null>(null);
  const [submitModal, setSubmitModal] = useState<{
    job: MarketJob;
    link: string;
  } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setJobs(null);
    try {
      setJobs(await fetchMarketJobs(20));
    } catch (err) {
      console.error(err);
      setError("Could not read the marketplace from Arc Testnet.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const role = (job: MarketJob): "client" | "provider" | null => {
    if (!address) return null;
    const a = address.toLowerCase();
    if (job.client.toLowerCase() === a) return "client";
    if (job.provider.toLowerCase() === a) return "provider";
    return null;
  };

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

  const handlePost = async () => {
    const amount = parseFloat(postForm.budget);
    if (!postForm.description.trim()) {
      setActionError("Enter a description.");
      return;
    }
    if (!amount || amount <= 0) {
      setActionError("Enter a budget greater than 0.");
      return;
    }
    const value = parseUnits(amount.toString(), USDC_DECIMALS);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + parseInt(postForm.duration) * 86400
    );
    const ok = await runTx("post", async () => {
      const approveHash = await walletClient!.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [AGENT_JOB_MARKET, value],
        chain: arcTestnet,
        account: address!,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      return walletClient!.writeContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "postJob",
        args: [postForm.description, value, deadline],
        chain: arcTestnet,
        account: address!,
      });
    });
    if (ok) {
      setShowPost(false);
      setPostForm({ description: "", budget: "", duration: "7" });
    }
  };

  const loadApps = async (job: MarketJob) => {
    const id = job.id.toString();
    if (openApps === id) {
      setOpenApps(null);
      return;
    }
    setOpenApps(id);
    if (!apps[id]) {
      const list = await fetchApplications(job.id);
      setApps((p) => ({ ...p, [id]: list }));
    }
  };

  const handleApply = async () => {
    if (!applyModal || !walletClient || !address) return;
    const price = parseFloat(applyModal.price || "0");
    const value = price > 0 ? parseUnits(price.toString(), USDC_DECIMALS) : 0n;
    setModalBusy(true);
    setActionError(null);
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "applyForJob",
        args: [applyModal.job.id, 0n, value, applyModal.proposal],
        chain: arcTestnet,
        account: address,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setApplyModal(null);
      await load();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setActionError(e.shortMessage || e.message || "Apply failed");
    } finally {
      setModalBusy(false);
    }
  };

  const handleSelect = (job: MarketJob, provider: string) =>
    runTx(`select-${job.id}`, () =>
      walletClient!.writeContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "selectProvider",
        args: [job.id, provider as `0x${string}`],
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
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "submit",
        args: [submitModal.job.id, deliverableHashFromLink(submitModal.link)],
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

  const handleApprove = (job: MarketJob) =>
    runTx(`approve-${job.id}`, () =>
      walletClient!.writeContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "approve",
        args: [job.id],
        chain: arcTestnet,
        account: address!,
      })
    );

  const handleCancel = (job: MarketJob) =>
    runTx(`cancel-${job.id}`, () =>
      walletClient!.writeContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "cancel",
        args: [job.id],
        chain: arcTestnet,
        account: address!,
      })
    );

  const stats = jobs
    ? {
        total: jobs.length,
        open: jobs.filter((j) => j.status === 0).length,
        escrow: jobs.reduce(
          (s, j) =>
            s + (j.status < 3 ? Number(formatUnits(j.budget, USDC_DECIMALS)) : 0),
          0
        ),
      }
    : null;

  const ZERO = "0x0000000000000000000000000000000000000000";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Open Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post open jobs, let agents apply, pick the best — our AgentJobMarket
            contract on Arc.
          </p>
        </div>
        <button
          onClick={() => setShowPost((s) => !s)}
          disabled={!address}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {address ? "Post a Job" : "Connect Wallet"}
        </button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Recent Jobs" value={stats?.total ?? "—"} accent="brand" />
        <StatCard label="Open" value={stats?.open ?? "—"} accent="info" />
        <StatCard
          label="Escrow Locked"
          value={stats ? `${stats.escrow.toFixed(2)} USDC` : "—"}
          accent="success"
        />
      </div>

      {actionError && (
        <div className="mb-6">
          <InlineError message={actionError} />
        </div>
      )}

      {showPost && (
        <GlassCard className="mb-8">
          <h2 className="font-semibold">Post an open job</h2>
          <div className="mt-4 space-y-4">
            <textarea
              placeholder="What do you need done?"
              value={postForm.description}
              onChange={(e) =>
                setPostForm({ ...postForm, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Budget (USDC) — locked in escrow"
                value={postForm.budget}
                onChange={(e) =>
                  setPostForm({ ...postForm, budget: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
              <select
                value={postForm.duration}
                onChange={(e) =>
                  setPostForm({ ...postForm, duration: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
            <button
              onClick={handlePost}
              disabled={busy === "post"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {busy === "post" ? <Spinner /> : null}
              {busy === "post" ? "Posting & funding…" : "Approve & Post Job"}
            </button>
          </div>
        </GlassCard>
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
          title="No open jobs yet"
          description="Be the first to post a job and let agents apply."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => {
            const id = job.id.toString();
            const r = role(job);
            const jobApps = apps[id] || [];
            return (
              <GlassCard key={id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Job #{id}</h3>
                    <StatusBadge status={job.status} kind="market" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Budget</div>
                    <div className="font-semibold text-success">
                      {formatUnits(job.budget, USDC_DECIMALS)} USDC
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {job.description || "No description"}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
                  <span>Client {shortAddr(job.client)}</span>
                  <span>
                    Provider{" "}
                    {job.provider === ZERO ? "—" : shortAddr(job.provider)}
                  </span>
                </div>

                <div className="mt-4">
                  {renderActions(job, r, id, jobApps)}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {applyModal && (
        <Modal onClose={() => !modalBusy && setApplyModal(null)}>
          <h2 className="text-lg font-semibold">
            Apply — Job #{applyModal.job.id.toString()}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Budget: {formatUnits(applyModal.job.budget, USDC_DECIMALS)} USDC
          </p>
          <textarea
            placeholder="Why you? How will you deliver?"
            value={applyModal.proposal}
            onChange={(e) =>
              setApplyModal({ ...applyModal, proposal: e.target.value })
            }
            rows={3}
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Proposed price (USDC, optional)"
            value={applyModal.price}
            onChange={(e) =>
              setApplyModal({ ...applyModal, price: e.target.value })
            }
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setApplyModal(null)}
              disabled={modalBusy}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={modalBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {modalBusy ? <Spinner /> : null} Submit Application
            </button>
          </div>
        </Modal>
      )}

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
              {modalBusy ? <Spinner /> : <Upload className="h-4 w-4" />} Submit
              Onchain
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  function renderActions(
    job: MarketJob,
    r: "client" | "provider" | null,
    id: string,
    jobApps: MarketApplication[]
  ) {
    const isBusy = (k: string) => busy === k;
    if (!address)
      return (
        <p className="text-xs text-muted-foreground">
          Connect your wallet to interact.
        </p>
      );

    if (job.status === 0) {
      if (r === "client")
        return (
          <div className="space-y-2">
            <button
              onClick={() => loadApps(job)}
              className="w-full rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              {openApps === id ? "Hide" : "View"} applications
            </button>
            {openApps === id && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                {jobApps.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    No applications yet.
                  </p>
                ) : (
                  jobApps.map((a) => (
                    <div
                      key={a.provider}
                      className="flex items-center gap-2 rounded-lg p-2 hover:bg-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs">
                          {shortAddr(a.provider)}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.proposal || "No proposal"}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelect(job, a.provider)}
                        disabled={isBusy(`select-${job.id}`)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                      >
                        {isBusy(`select-${job.id}`) ? "…" : "Select"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
            <button
              onClick={() => handleCancel(job)}
              disabled={isBusy(`cancel-${job.id}`)}
              className="text-xs text-muted-foreground hover:text-danger"
            >
              Cancel job & refund
            </button>
          </div>
        );
      return (
        <button
          onClick={() => setApplyModal({ job, price: "", proposal: "" })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Apply for this job
        </button>
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
          Provider selected: {shortAddr(job.provider)}. Awaiting delivery.
        </p>
      );
    }

    if (job.status === 2) {
      if (r === "client")
        return (
          <button
            onClick={() => handleApprove(job)}
            disabled={isBusy(`approve-${job.id}`)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {isBusy(`approve-${job.id}`) ? <Spinner /> : null} Approve & Release
            Escrow
          </button>
        );
      return (
        <p className="text-xs text-info">Delivered. Awaiting client approval.</p>
      );
    }

    if (job.status === 3)
      return (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> Completed — escrow released to{" "}
          {shortAddr(job.provider)}.
        </p>
      );

    return (
      <a
        href={`${ARC_EXPLORER}/address/${AGENT_JOB_MARKET}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-info hover:underline"
      >
        View contract ↗
      </a>
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
