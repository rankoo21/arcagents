import { formatUnits } from "viem";
import {
  publicClient,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  identityAbi,
  reputationAbi,
  getLogWindow,
} from "../contracts";

export interface AgentMetadata {
  name?: string;
  description?: string;
  agent_type?: string;
  type?: string;
  capabilities?: string[];
  image?: string;
}

export interface OnchainAgent {
  tokenId: bigint;
  owner: string;
  metadataURI: string;
  metadata: AgentMetadata | null;
  reputationScore: number | null; // average normalized 0-100, null = no feedback
  feedbackCount: number;
}

// Resolve agent metadata from a data-URI or IPFS/HTTP URL. Metadata is optional.
export async function resolveMetadata(
  uri: string
): Promise<AgentMetadata | null> {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      return JSON.parse(atob(uri.split(",")[1]));
    }
    if (uri.startsWith("data:application/json,")) {
      return JSON.parse(decodeURIComponent(uri.split(",")[1]));
    }
    let httpUrl = uri;
    if (uri.startsWith("ipfs://")) {
      httpUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }
    if (httpUrl.startsWith("http")) {
      const res = await fetch(httpUrl);
      if (res.ok) return (await res.json()) as AgentMetadata;
    }
  } catch {
    // ignore — metadata is optional
  }
  return null;
}

// Read all registered ERC-8004 agents in the recent block window, with their
// aggregated onchain reputation. Shared by the Agents page and the job creator.
export async function fetchOnchainAgents(limit = 24): Promise<OnchainAgent[]> {
  const { fromBlock, toBlock } = await getLogWindow();

  // 1. Minted identities (Transfer from zero address)
  const transferLogs = await publicClient.getLogs({
    address: IDENTITY_REGISTRY,
    event: identityAbi[3],
    fromBlock,
    toBlock,
  });
  const mintLogs = transferLogs.filter(
    (log) => log.args.from === "0x0000000000000000000000000000000000000000"
  );

  // 2. Aggregate reputation from NewFeedback events
  const feedbackLogs = await publicClient.getLogs({
    address: REPUTATION_REGISTRY,
    event: reputationAbi[1],
    fromBlock,
    toBlock,
  });
  const repByAgent = new Map<string, { sum: number; count: number }>();
  for (const log of feedbackLogs) {
    const a = log.args as {
      agentId?: bigint;
      value?: bigint;
      valueDecimals?: number;
    };
    if (a.agentId === undefined || a.value === undefined) continue;
    const decimals = a.valueDecimals ?? 0;
    const normalized = Number(formatUnits(a.value, decimals));
    if (normalized < 0 || normalized > 100) continue; // score-like only
    const key = a.agentId.toString();
    const prev = repByAgent.get(key) || { sum: 0, count: 0 };
    repByAgent.set(key, { sum: prev.sum + normalized, count: prev.count + 1 });
  }

  // 3. Read owner + metadata for the most recent agents
  const recent = mintLogs.slice(-limit).reverse();
  const results: OnchainAgent[] = [];
  for (const log of recent) {
    const tokenId = log.args.tokenId!;
    try {
      const owner = (await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: "ownerOf",
        args: [tokenId],
      })) as string;

      let metadataURI = "";
      let metadata: AgentMetadata | null = null;
      try {
        metadataURI = (await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: identityAbi,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;
        metadata = await resolveMetadata(metadataURI);
      } catch {
        // token may have no URI
      }

      const rep = repByAgent.get(tokenId.toString());
      results.push({
        tokenId,
        owner,
        metadataURI,
        metadata,
        reputationScore: rep ? Math.round(rep.sum / rep.count) : null,
        feedbackCount: rep ? rep.count : 0,
      });
    } catch {
      // token burned or unreadable — skip
    }
  }

  return results;
}

// Stable emoji avatars chosen by token id
export const AGENT_AVATARS = ["🤖", "🧠", "⚙️", "🛰️", "🔮", "📡", "🦾", "💡"];
export const agentAvatar = (tokenId: bigint, fallbackIndex = 0) =>
  AGENT_AVATARS[Number(tokenId % 8n)] || AGENT_AVATARS[fallbackIndex % 8];
