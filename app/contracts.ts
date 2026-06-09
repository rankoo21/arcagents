import {
  createPublicClient,
  http,
  keccak256,
  toHex,
  type Address,
} from "viem";
import { arcTestnet } from "viem/chains";

// ── Arc Testnet Chain ──
// Use viem's official definition (chainId 5042002). Re-exported so the rest of
// the app imports it from one place.
export { arcTestnet };

// Chain id in hex, used for wallet_switchEthereumChain / wallet_addEthereumChain
export const ARC_CHAIN_ID = arcTestnet.id;
export const ARC_CHAIN_ID_HEX = `0x${arcTestnet.id.toString(16)}`;
export const ARC_RPC_URL = arcTestnet.rpcUrls.default.http[0];
export const ARC_EXPLORER = arcTestnet.blockExplorers!.default.url;

// ── Contract Addresses (Arc Testnet) ──
export const IDENTITY_REGISTRY: Address =
  "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const REPUTATION_REGISTRY: Address =
  "0x8004B663056A597Dffe9eCcC1965A193B7388713";
export const VALIDATION_REGISTRY: Address =
  "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";
export const AGENTIC_COMMERCE: Address =
  "0x0747EEf0706327138c69792bF28Cd525089e4583";
export const USDC_ADDRESS: Address =
  "0x3600000000000000000000000000000000000000";

// ── Our own contract: AgentJobMarket (open-bidding marketplace w/ USDC escrow) ──
// Deployed by us on Arc Testnet. Unlike ERC-8183 (provider pre-assigned), this
// lets clients post open jobs that any agent can apply to, then pick a winner.
export const AGENT_JOB_MARKET: Address =
  "0x103c2778f1224826898BE8891fCE0a08C7aFc99a";

// USDC on Arc is an ERC-20 with 6 decimals
export const USDC_DECIMALS = 6;

// Arc RPC caps eth_getLogs at 10,000 blocks — stay safely under it.
export const LOG_BLOCK_RANGE = 9000n;

// ── Public Client ──
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

// Compute an explicit [fromBlock, toBlock] window of at most LOG_BLOCK_RANGE
// blocks. Using an explicit toBlock (not "latest") guarantees the range can
// never exceed the RPC limit due to timing.
export async function getLogWindow(): Promise<{
  fromBlock: bigint;
  toBlock: bigint;
}> {
  const toBlock = await publicClient.getBlockNumber();
  const fromBlock = toBlock > LOG_BLOCK_RANGE ? toBlock - LOG_BLOCK_RANGE : 0n;
  return { fromBlock, toBlock };
}

// ── ABIs ──
export const identityAbi = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "Transfer",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export const reputationAbi = [
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "int128" },
      { name: "feedbackType", type: "uint8" },
      { name: "tag", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "evidenceURI", type: "string" },
      { name: "comment", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
  // Real event emitted by the Arc ReputationRegistry on every feedback.
  // topic0 = 0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc
  {
    name: "NewFeedback",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "clientAddress", type: "address" },
      { indexed: false, name: "feedbackIndex", type: "uint64" },
      { indexed: false, name: "value", type: "int128" },
      { indexed: false, name: "valueDecimals", type: "uint8" },
      { indexed: true, name: "indexedTag1", type: "string" },
      { indexed: false, name: "tag1", type: "string" },
      { indexed: false, name: "tag2", type: "string" },
      { indexed: false, name: "endpoint", type: "string" },
      { indexed: false, name: "feedbackURI", type: "string" },
      { indexed: false, name: "feedbackHash", type: "bytes32" },
    ],
  },
] as const;

export const agenticCommerceAbi = [
  {
    name: "createJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "setBudget",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "fund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "submit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "complete",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
  {
    name: "JobCreated",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "evaluator", type: "address" },
      { indexed: false, name: "expiredAt", type: "uint256" },
      { indexed: false, name: "hook", type: "address" },
    ],
  },
  // Real event emitted by the Arc Agentic Commerce contract when a provider
  // submits a deliverable. topic0 = 0x80c17db7...40538e
  {
    name: "JobSubmitted",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "deliverable", type: "bytes32" },
    ],
  },
  // Real event emitted when the evaluator completes a job.
  // topic0 = 0x0fd54bd3...341444
  {
    name: "JobCompleted",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "evaluator", type: "address" },
      { indexed: false, name: "reason", type: "bytes32" },
    ],
  },
] as const;

// ── Our AgentJobMarket ABI (open-bidding marketplace) ──
export const jobMarketAbi = [
  {
    name: "postJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "description", type: "string" },
      { name: "budget", type: "uint256" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "applyForJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "agentId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "proposal", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "selectProvider",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "provider", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "submit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "budget", type: "uint256" },
          { name: "createdAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "description", type: "string" },
          { name: "deliverable", type: "bytes32" },
        ],
      },
    ],
  },
  {
    name: "getApplications",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "provider", type: "address" },
          { name: "agentId", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "proposal", type: "string" },
        ],
      },
    ],
  },
  {
    name: "nextJobId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "JobPosted",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: false, name: "budget", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint64" },
      { indexed: false, name: "description", type: "string" },
    ],
  },
  {
    name: "Applied",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "agentId", type: "uint256" },
      { indexed: false, name: "price", type: "uint256" },
      { indexed: false, name: "proposal", type: "string" },
    ],
  },
  {
    name: "ProviderSelected",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
    ],
  },
  {
    name: "Submitted",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "deliverable", type: "bytes32" },
    ],
  },
  {
    name: "Completed",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    name: "Cancelled",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: false, name: "refund", type: "uint256" },
    ],
  },
] as const;

export const MARKET_STATUS_NAMES = [
  "Open",
  "Assigned",
  "Submitted",
  "Completed",
  "Cancelled",
];

export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const JOB_STATUS_NAMES = [
  "Open",
  "Funded",
  "Submitted",
  "Completed",
  "Rejected",
  "Expired",
];

// Map a numeric job status to a CSS status-badge class.
export const JOB_STATUS_CLASSES = [
  "open",
  "funded",
  "submitted",
  "completed",
  "open",
  "open",
];

// Short helper for displaying addresses
export const shortAddr = (a?: string) =>
  a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";

// Deterministic deliverable hash from a link/text. The provider submits this
// hash onchain; anyone can recompute it from the same link to verify the
// deliverable wasn't swapped after submission.
export const deliverableHashFromLink = (link: string): `0x${string}` =>
  keccak256(toHex(link.trim()));
