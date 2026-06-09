import {
  publicClient,
  AGENT_JOB_MARKET,
  jobMarketAbi,
  getLogWindow,
} from "../contracts";

export interface MarketJob {
  id: bigint;
  client: string;
  provider: string;
  budget: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: number; // 0 Open,1 Assigned,2 Submitted,3 Completed,4 Cancelled
  description: string;
  deliverable: string;
}

export interface MarketApplication {
  provider: string;
  agentId: bigint;
  price: bigint;
  proposal: string;
}

// Read recent jobs from our AgentJobMarket via JobPosted events.
export async function fetchMarketJobs(limit = 20): Promise<MarketJob[]> {
  const { fromBlock, toBlock } = await getLogWindow();

  const logs = await publicClient.getLogs({
    address: AGENT_JOB_MARKET,
    event: jobMarketAbi.find(
      (x) => x.type === "event" && x.name === "JobPosted"
    ) as never,
    fromBlock,
    toBlock,
  });

  const ids: bigint[] = [];
  const seen = new Set<string>();
  for (let i = logs.length - 1; i >= 0 && ids.length < limit; i--) {
    const jid = (logs[i] as { args: { jobId?: bigint } }).args.jobId;
    if (jid !== undefined && !seen.has(jid.toString())) {
      seen.add(jid.toString());
      ids.push(jid);
    }
  }

  const jobs: MarketJob[] = [];
  for (const id of ids) {
    try {
      const job = (await publicClient.readContract({
        address: AGENT_JOB_MARKET,
        abi: jobMarketAbi,
        functionName: "getJob",
        args: [id],
      })) as MarketJob;
      jobs.push(job);
    } catch {
      // skip unreadable
    }
  }
  return jobs;
}

export async function fetchApplications(
  jobId: bigint
): Promise<MarketApplication[]> {
  try {
    const apps = (await publicClient.readContract({
      address: AGENT_JOB_MARKET,
      abi: jobMarketAbi,
      functionName: "getApplications",
      args: [jobId],
    })) as MarketApplication[];
    return apps;
  } catch {
    return [];
  }
}
