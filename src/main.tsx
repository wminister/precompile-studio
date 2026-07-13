import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Blocks,
  Check,
  ChevronDown,
  CircleDot,
  Clipboard,
  Code2,
  Download,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  Route,
  TerminalSquare,
  Upload,
  Wallet,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import {
  concatHex,
  decodeAbiParameters,
  decodeEventLog,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  isAddress,
  keccak256,
  parseEther,
  parseAbi,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
} from "viem";
import ritualTestnetDeployment from "../deployments/ritual-testnet.json";
import { encryptAgentProviderSecret } from "./agentCrypto";
import "./styles.css";

export { encryptAgentProviderSecret } from "./agentCrypto";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    __precompileStudioRoot?: ReturnType<typeof createRoot>;
  }
}

export type Eip1193Provider = {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isRabby?: boolean;
  isMetaMask?: boolean;
};

// EIP-6963: wallets announce themselves so a dapp can pick a specific one even
// when several extensions fight over window.ethereum.
type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: Eip1193Provider;
};

export type WalletTransactionRequest = {
  from: string;
  to: string;
  chainId?: string;
  data?: string;
  value?: string;
  type?: string;
  gas?: string;
  gasPrice?: string;
  nonce?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export type SendWalletTransactionOptions = {
  signFirst?: boolean;
};

function isRabbyProvider(provider: Eip1193Provider | undefined) {
  return Boolean(provider?.isRabby);
}

// Prefer Rabby, then MetaMask, then the first announced provider, and only fall
// back to window.ethereum when EIP-6963 found nothing. Using EIP-6963 lets us
// reach the chosen wallet even when another extension has locked window.ethereum.
function pickInjectedProvider(wallets: EIP6963ProviderDetail[]): Eip1193Provider | undefined {
  const rabby = wallets.find((wallet) => wallet.info.rdns === "io.rabby" || wallet.provider.isRabby);
  if (rabby) return rabby.provider;
  const metaMask = wallets.find(
    (wallet) => wallet.info.rdns === "io.metamask" || wallet.provider.isMetaMask,
  );
  if (metaMask) return metaMask.provider;
  if (wallets.length) return wallets[0].provider;
  return window.ethereum;
}

type RpcState = {
  status: "checking" | "online" | "offline";
  chainId?: number;
  block?: number;
  latency?: number;
  error?: string;
};

type WalletState = {
  status: "idle" | "connecting" | "connected" | "error";
  address?: string;
  chainId?: number;
  balance?: string;
  ritualWalletBalance?: string;
  ritualLockUntil?: number;
  ritualWalletError?: string;
  error?: string;
};

type DepositState = {
  status: "idle" | "submitting" | "submitted" | "error";
  hash?: string;
  error?: string;
};

type TransactionState = {
  status: "idle" | "submitting" | "submitted" | "error";
  hash?: string;
  error?: string;
};

type ImportState = {
  status: "idle" | "checking" | "imported" | "error";
  error?: string;
};

export type JqDecodedOutput = {
  outputType: string;
  value: string | boolean | Array<string | boolean>;
  display: string;
  isEmpty: boolean;
  raw: string;
};

type JqCallState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: JqDecodedOutput }
  | { status: "empty"; raw: string }
  | { status: "error"; error: string; raw?: string };

type LlmRun = {
  hash: string;
  submittedAt: number;
  status: ReceiptStatus;
  receipt?: RpcReceipt;
  error?: string;
};

type AgentRun = {
  hash: string;
  submittedAt: number;
  status: ReceiptStatus;
  receipt?: RpcReceipt;
  error?: string;
};

type AgentHarnessState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: AgentHarnessStatus }
  | { status: "error"; error: string };

export type AgentLifecycle = {
  status: "idle" | "scheduled" | "committed" | "result-ready" | "settled" | "failed" | "expired";
  jobId?: string;
  executor?: string;
  commitBlock?: number;
  settledBlock?: number;
  transactionHash?: string;
  result?: ReturnType<typeof decodeSovereignAgentResult>;
  error?: string;
};

type AgentLifecycleState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: AgentLifecycle }
  | { status: "error"; error: string };

export type ScheduledJqConsumerStatus = {
  address: string;
  owner: string;
  balance: bigint;
  lockUntil: bigint;
  activeScheduleId: bigint;
  lastScheduleId: bigint;
  scheduleState: number;
  executionCount: bigint;
  lastExecutionIndex: bigint;
  activeNumCalls: number;
  lastResult: `0x${string}`;
  lifecycle: SchedulerLifecycleEntry[];
};

export type SchedulerLifecycleEntry = {
  kind: "scheduled" | "executed" | "completed" | "failed" | "skipped-funds" | "skipped-ttl" | "expired" | "cancelled";
  label: string;
  detail: string;
  tone: "neutral" | "ok" | "warning" | "bad";
  blockNumber?: number;
  transactionHash?: string;
};

type ScheduledJqConsumerState =
  | { status: "idle" | "loading" }
  | { status: "missing"; predictedAddress: string }
  | { status: "ready"; data: ScheduledJqConsumerStatus }
  | { status: "error"; error: string };

type SchedulerAction = "deploy" | "schedule" | "cancel" | "withdraw";

type SchedulerTransactionState = TransactionState & { action?: SchedulerAction };

type CopyFeedback = {
  tone: "ok" | "bad";
  message: string;
};

type RunnerCodeState = {
  status: "idle" | "checking" | "contract" | "empty" | "error";
  address?: string;
  byteLength?: number;
  error?: string;
};

type ReceiptStatus = "pending" | "confirmed" | "failed";
type RunnerHistoryFilter = "all" | ReceiptStatus;

export type RpcReceipt = {
  transactionHash: string;
  blockNumber?: string;
  status?: string;
  gasUsed?: string;
  logs?: unknown[];
  spcCalls?: unknown;
};

export type SpcCall = {
  address?: string;
  input?: string;
  output?: string;
  proof?: string;
  blockNumber?: number;
};

export type RunnerRun = {
  hash: string;
  runnerAddress: string;
  submittedAt: number;
  method: string;
  url: string;
  source?: "wallet" | "imported";
  status: ReceiptStatus;
  receipt?: RpcReceipt;
  error?: string;
};

type RpcLog = {
  address?: string;
  data?: string;
  topics?: string[];
  blockNumber?: string;
  transactionHash?: string;
};

export type RunnerCallbackEvidence = {
  status: "pending" | "complete" | "http-error" | "precompile-error" | "missing";
  detail: string;
  result?: {
    caller?: string;
    statusCode?: number;
    headers?: Array<{ name: string; value: string }>;
    contentType?: string;
    bodyBytes?: number;
    bodyText?: string;
    bodyPreview?: string;
    bodyPreviewTruncated?: boolean;
    errorMessage?: string;
  };
};

export type LlmPrecompileEvidence = {
  status: "complete" | "precompile-error";
  detail: string;
  result: {
    hasError: boolean;
    completionBytes: number;
    completionText?: string;
    completion?: {
      id: string;
      model: string;
      role?: string;
      content?: string;
      finishReason?: string;
      promptTokens?: string;
      completionTokens?: string;
      totalTokens?: string;
    };
    metadataBytes: number;
    metadataText?: string;
    metadata?: {
      model: string;
      parameterCount: string;
      datatype: string;
      maxSequenceLength: string;
    };
    errorMessage?: string;
    updatedConvoHistory: StorageRefTuple;
  };
};

type AbiDraftView = {
  label: string;
  abi: string;
  encodedInput?: string;
  errors: string[];
  facts: Array<{
    label: string;
    value: string;
    copyValue: string;
  }>;
};

type StorageRefTuple = [string, string, string];

type SavedRunner = {
  address: string;
  label: string;
  updatedAt: number;
};

type SavedExecutor = {
  address: string;
  label: string;
  updatedAt: number;
};

type DiscoveredExecutor = {
  address: string;
  capabilityId: number;
  publicKey?: string;
  isValid?: boolean;
};

type ExecutorDiscoveryState = {
  status: "idle" | "loading" | "ready" | "error";
  capabilityId: number;
  executors: DiscoveredExecutor[];
  total?: number;
  error?: string;
};

type RecipePreset = {
  id: string;
  recipeId: RecipeId;
  label: string;
  fields: ComposerField[];
  updatedAt: number;
  source?: "local" | "example";
};

export type RecipeId = "http" | "jq" | "llm" | "agent" | "scheduler";

export type Recipe = {
  id: RecipeId;
  name: string;
  label: string;
  icon: React.ElementType;
  status: "live" | "degraded" | "owner-only" | "preview";
  description: string;
  fields: ComposerField[];
};

export type ComposerField = {
  key: string;
  label: string;
  value: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
};

export const RITUAL = {
  chainId: 1979,
  chainHex: "0x7bb",
  rpc: "https://rpc.ritualfoundation.org",
  explorer: "https://explorer.ritualfoundation.org",
  faucet: "https://faucet.ritualfoundation.org",
  docs: "https://docs.ritualfoundation.org",
};

export const RITUAL_CHAIN_PARAMS = {
  chainId: RITUAL.chainHex,
  chainName: "Ritual Testnet",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: [RITUAL.rpc],
  blockExplorerUrls: [RITUAL.explorer],
};

export const SYSTEM_CONTRACTS = {
  RitualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  AsyncJobTracker: "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5",
  TEEServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  Scheduler: "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  AsyncDelivery: "0x5A16214fF555848411544b005f7Ac063742f39F6",
} as const;

const EXECUTOR_CAPABILITIES = [
  { id: 0, label: "HTTP candidates", recipeIds: ["http"] as RecipeId[] },
  { id: 1, label: "LLM candidates", recipeIds: ["llm"] as RecipeId[] },
  { id: 3, label: "Streaming candidates", recipeIds: [] as RecipeId[] },
  { id: 4, label: "Capability 4", recipeIds: [] as RecipeId[] },
  { id: 5, label: "Capability 5", recipeIds: [] as RecipeId[] },
  { id: 6, label: "Capability 6", recipeIds: [] as RecipeId[] },
  { id: 7, label: "Capability 7", recipeIds: [] as RecipeId[] },
  { id: 8, label: "Capability 8", recipeIds: [] as RecipeId[] },
  { id: 9, label: "Capability 9", recipeIds: [] as RecipeId[] },
  { id: 10, label: "Capability 10", recipeIds: [] as RecipeId[] },
  { id: 12, label: "Capability 12", recipeIds: [] as RecipeId[] },
];

function defaultCapabilityForRecipe(recipeId: RecipeId) {
  return EXECUTOR_CAPABILITIES.find((capability) => capability.recipeIds.includes(recipeId))?.id ?? 0;
}

function capabilityLabel(capabilityId: number) {
  return EXECUTOR_CAPABILITIES.find((capability) => capability.id === capabilityId)?.label ?? `Capability ${capabilityId}`;
}

export const HTTP_CALL_PRECOMPILE = "0x0000000000000000000000000000000000000801";
const LLM_INFERENCE_PRECOMPILE = "0x0000000000000000000000000000000000000802";
export const JQ_PRECOMPILE = "0x0000000000000000000000000000000000000803";
const SOVEREIGN_AGENT_PRECOMPILE = "0x000000000000000000000000000000000000080c";
const HTTP_ABI_SIGNATURE =
  "address, bytes[], uint256, bytes[], bytes, string, uint8, string[], string[], bytes, uint256, uint8, bool";
const LLM_ABI_SIGNATURE =
  "address, bytes[], uint256, bytes[], bytes, string, string, int256, string, bool, int256, string, string, uint256, bool, int256, string, bytes, int256, string, string, bool, int256, bytes, bytes, int256, int256, string, bool, (string,string,string)";
const JQ_ABI_SIGNATURE = "string, string, uint8";
const SOVEREIGN_AGENT_ABI_SIGNATURE =
  "address, uint256, bytes, uint64, uint64, string, address, bytes4, uint256, uint256, uint256, uint16, string, bytes, (string,string,string), (string,string,string), (string,string,string)[], (string,string,string), string, string[], uint16, uint32, string";
const AGENT_HARNESS_CONFIG_SIGNATURE =
  `(${SOVEREIGN_AGENT_ABI_SIGNATURE}), (uint32,uint32,uint32,uint256,uint256,uint256), (uint32,uint16,uint16), uint256`;
const EXECUTOR_STORAGE_PREFIX = "precompile-studio:executors";
const RUNNER_STORAGE_PREFIX = "precompile-studio:runners";
const RUNNER_HISTORY_STORAGE_PREFIX = "precompile-studio:runner-history";
const RUNNER_HISTORY_LIMIT = 5;
// The node rejects async precompile payloads whose escrow lock does not extend
// far enough ahead ("insufficient lock duration"). Observed requirement is
// ~2.3k blocks; guard with headroom so users lock comfortably past it.
const RITUAL_ASYNC_LOCK_MARGIN = 5000;
const CALLBACK_BODY_PREVIEW_LIMIT = 140;
const RUNNER_HISTORY_FILTERS: Array<{ key: RunnerHistoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "failed", label: "Failed" },
];
const PRESET_STORAGE_KEY = "precompile-studio:recipe-presets";
const HTTP_PRECOMPILE_CONSUMER_ADDRESS = ritualTestnetDeployment.contracts.HttpPrecompileConsumer.address;
export const LLM_PRECOMPILE_CONSUMER_ADDRESS = ritualTestnetDeployment.contracts.LlmPrecompileConsumer.address;
export const SOVEREIGN_AGENT_FACTORY_ADDRESS = ritualTestnetDeployment.contracts.SovereignAgentHarness.factory;
export const SOVEREIGN_AGENT_HARNESS_ADDRESS = ritualTestnetDeployment.contracts.SovereignAgentHarness.address;
const DEFAULT_HTTP_RUNNER_ADDRESS = HTTP_PRECOMPILE_CONSUMER_ADDRESS;
const DEFAULT_LLM_MODEL = "zai-org/GLM-4.7-FP8";
const DEFAULT_LLM_EXECUTOR = "0xb42e435c4252a5a2e7440e37b609f00c61a0c91b";

const FAQ_ITEMS = [
  {
    question: "What exactly does Precompile Studio do?",
    answer:
      "Precompile Studio is a Ritual testnet workbench. It turns human-readable recipe fields into the exact calldata needed for Ritual precompiles, then shows whether your wallet, chain, gas, RitualWallet balance, and selected route are ready before you copy or submit anything.",
  },
  {
    question: "How do I use it from start to finish?",
    answer:
      "Pick a recipe tab, fill the fields, resolve any red ABI or readiness checks, then use the recipe action. JQ runs immediately through Ritual RPC without a wallet. HTTP and non-streaming LLM calls submit through their verified consumers after you confirm the transaction in MetaMask.",
  },
  {
    question: "What is the simplest example?",
    answer:
      "Use the HTTP 200 echo preset, choose a registered executor, and connect MetaMask on Ritual. The studio encodes the request, sends it through the verified HTTP consumer, and separates the confirmed transaction from the HTTP response returned in receipt.spcCalls.",
  },
  {
    question: "Does the app send transactions automatically?",
    answer:
      "No. The studio prepares and validates data locally in the browser. It only asks your wallet to send a transaction when you explicitly press a send action, and the wallet confirmation is still required.",
  },
  {
    question: "Who pays gas?",
    answer:
      "JQ uses a read-only eth_call, so it needs no wallet or gas. For transaction-based recipes, the connected user pays their own Ritual testnet gas. The studio does not sponsor or relay transactions, and async flows also use the connected account's RitualWallet escrow.",
  },
  {
    question: "Which wallet should I use?",
    answer:
      "Use MetaMask for Ritual transaction submission. Rabby can connect and read Ritual state, but it currently converts custom Ritual transactions to a legacy type that the Ritual RPC rejects, then refuses the raw-signing fallback. This is a Rabby and custom-network compatibility limitation rather than a failed Studio simulation.",
  },
  {
    question: "Which recipes can every visitor run?",
    answer:
      "HTTP, JQ, and Scheduled JQ are publicly usable. The first Scheduled JQ use creates one deterministic consumer owned by the connected wallet. LLM submission is implemented, but Ritual's current executor path may return an infrastructure error instead of a completion. The current Sovereign Agent harness remains owner-only.",
  },
  {
    question: "How does Scheduled JQ pay for future calls?",
    answer:
      "Each wallet gets its own Scheduled JQ consumer and contract-owned RitualWallet escrow. The studio calculates Ritual's 0.01 RITUAL Scheduler reserve plus the execution budget. If escrow is short, Fund & schedule deposits exactly the shortfall and creates the schedule in one wallet transaction. The same wallet can cancel active calls or withdraw unused escrow after its lock expires.",
  },
  {
    question: "What is stored by the app?",
    answer:
      "Drafts, saved presets, consumer addresses, and HTTP transaction history stay in the browser's local storage. The app warns about secret-looking fields before copying or sharing previews.",
  },
  {
    question: "Do I need a private key?",
    answer:
      "Not for normal browser use. Connect your wallet for signing. A private key is only needed when deploying a consumer contract from your terminal, and that should be a testnet-only deployer key.",
  },
] as const;

const FAQ_WORKFLOW_STEPS = [
  {
    title: "Choose a recipe",
    body: "HTTP, JQ, LLM, Agent, and Scheduler recipes each map to a different Ritual precompile or system flow.",
  },
  {
    title: "Fill the fields",
    body: "Use the composer fields as the source of truth. Presets are only starting points; replace zero addresses and placeholder values before encoding.",
  },
  {
    title: "Resolve checks",
    body: "The readiness strip and inspector show RPC, wallet, chain, gas, escrow, executor, and ABI problems before a transaction leaves the app.",
  },
  {
    title: "Copy or submit",
    body: "Run JQ directly through RPC, copy exports when useful, or connect a wallet and send HTTP through the consumer panel.",
  },
  {
    title: "Trace the result",
    body: "HTTP history stores submitted hashes locally, polls receipts, and separates on-chain confirmation, precompile execution, and the target server's HTTP response.",
  },
] as const;

const HTTP_METHOD_IDS: Record<string, number> = {
  GET: 1,
  POST: 2,
  PUT: 3,
  DELETE: 4,
  PATCH: 5,
  HEAD: 6,
  OPTIONS: 7,
};

const RECIPE_STATUS_LABELS: Record<Recipe["status"], string> = {
  live: "Live",
  degraded: "Ritual degraded",
  "owner-only": "Owner only",
  preview: "Preview",
};

export const JQ_OUTPUT_TYPES: Record<string, number> = {
  int256: 0,
  uint256: 1,
  string: 2,
  bool: 3,
  address: 4,
  "int256[]": 5,
  "uint256[]": 6,
  "string[]": 7,
  "bool[]": 8,
  "address[]": 9,
};

const JQ_DYNAMIC_OUTPUT_TYPES = new Set(["string", "int256[]", "uint256[]", "string[]", "bool[]", "address[]"]);

const AGENT_CALLBACK_SELECTOR = "0x8ca12055";
const AGENT_CONFIGURE_SELECTOR = "0xb1906702";
const AGENT_SCHEDULE = [5_000_000, 2_000, 500, 20_000_000_000n, 1_000_000_000n, 0n] as const;
const AGENT_ROLLING = [5, 5_000, 1] as const;
const AGENT_LOCK_BLOCKS = 100_000n;
const AGENT_DEPLOYMENT_BLOCK = ritualTestnetDeployment.contracts.SovereignAgentHarness.blockNumber;
const JOB_ADDED_TOPIC = keccak256(stringToHex("JobAdded(address,bytes32,address,uint256,bytes,address,bytes32,uint256,uint256,uint256,uint256)"));
const PHASE1_SETTLED_TOPIC = keccak256(stringToHex("Phase1Settled(bytes32,address,uint256)"));
const RESULT_DELIVERED_TOPIC = keccak256(stringToHex("ResultDelivered(bytes32,address,bool)"));
const JOB_REMOVED_TOPIC = keccak256(stringToHex("JobRemoved(address,bytes32,bool)"));
const SOVEREIGN_RESULT_TOPIC = keccak256(stringToHex("SovereignResult(bytes32,bytes)"));
export const SCHEDULED_JQ_CONSUMER_ADDRESS = ritualTestnetDeployment.contracts.ScheduledJqConsumer.address;
export const SCHEDULED_JQ_FACTORY_ADDRESS = ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.address;
const SCHEDULER_RESERVE = 10_000_000_000_000_000n;
const SCHEDULER_LOCK_BLOCKS = 50_000n;
const SCHEDULER_ORIGIN_TX_STORAGE_PREFIX = "precompile-studio:scheduler-origin-tx";
const SCHEDULE_STATE_LABELS = ["Scheduled", "Executing", "Completed", "Cancelled", "Expired"] as const;
const SCHEDULED_JQ_DEPLOYMENT_BLOCK = ritualTestnetDeployment.contracts.ScheduledJqConsumer.blockNumber;
const SCHEDULED_JQ_FACTORY_DEPLOYMENT_BLOCK = ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.blockNumber;
const SCHEDULED_JQ_SMOKE_RUNS = [
  {
    consumer: ritualTestnetDeployment.contracts.ScheduledJqConsumer.address,
    callId: BigInt(ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeCallId),
    transaction: ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeTransaction,
    block: ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeBlock,
    startBlock: ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeStartBlock,
    frequency: ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeFrequency,
    numCalls: ritualTestnetDeployment.contracts.ScheduledJqConsumer.smokeNumCalls,
  },
  {
    consumer: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeConsumer,
    callId: BigInt(ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeCallId),
    transaction: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeScheduleTransaction,
    block: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeScheduleBlock,
    startBlock: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeStartBlock,
    frequency: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeFrequency,
    numCalls: ritualTestnetDeployment.contracts.ScheduledJqConsumerFactory.smokeNumCalls,
  },
] as const;

const schedulerLifecycleAbi = parseAbi([
  "event CallScheduled(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data)",
  "event CallExecuted(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 numCalls, uint32 frequency, uint256 executionIndex, uint256 gasUsed, uint256 feesPaid)",
  "event CallExecutionFailed(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 numCalls, uint32 frequency, uint256 executionIndex, uint256 gasUsed, string reason)",
  "event CallExpired(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 expiryBlock, uint256 expiredAtBlock)",
  "event CallSkippedInsufficientFunds(uint256 indexed callId, address indexed to, address indexed caller, uint256 requiredAmount, uint256 availableAmount)",
  "event CallSkippedTTLExpired(uint256 indexed callId, address indexed to, address indexed caller, uint256 expectedBlock, uint256 currentBlock, uint32 ttl)",
  "event CallCancelled(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 numCalls, uint32 frequency)",
  "event CallCompleted(uint256 indexed callId, address indexed to, address indexed caller, uint32 startBlock, uint32 numCalls, uint32 frequency, uint256 totalExecutions)",
]);
const SCHEDULER_LIFECYCLE_TOPICS = schedulerLifecycleAbi.map((event) =>
  keccak256(stringToHex(`${event.name}(${event.inputs.map((input) => input.type).join(",")})`)),
);

const scheduledJqConsumerAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "payable",
    inputs: [{ name: "lockDuration", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "scheduleTransform",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jqFilter", type: "string" },
      { name: "inputJson", type: "string" },
      { name: "outputType", type: "uint8" },
      { name: "frequency", type: "uint32" },
      { name: "numCalls", type: "uint32" },
      { name: "gasLimit", type: "uint32" },
      { name: "ttl", type: "uint32" },
      { name: "maxFeePerGas", type: "uint256" },
    ],
    outputs: [{ name: "callId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundAndSchedule",
    stateMutability: "payable",
    inputs: [
      { name: "jqFilter", type: "string" },
      { name: "inputJson", type: "string" },
      { name: "outputType", type: "uint8" },
      { name: "frequency", type: "uint32" },
      { name: "numCalls", type: "uint32" },
      { name: "gasLimit", type: "uint32" },
      { name: "ttl", type: "uint32" },
      { name: "maxFeePerGas", type: "uint256" },
      { name: "lockDuration", type: "uint256" },
    ],
    outputs: [{ name: "callId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelSchedule",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  ...[
    ["consumerBalance", "uint256"],
    ["activeScheduleId", "uint256"],
    ["lastScheduleId", "uint256"],
    ["activeScheduleState", "uint8"],
    ["executionCount", "uint256"],
    ["lastExecutionIndex", "uint256"],
    ["activeNumCalls", "uint32"],
    ["lastResult", "bytes"],
  ].map(([name, type]) => ({
    type: "function" as const,
    name,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type }],
  })),
  {
    type: "function",
    name: "requiredWalletBalance",
    stateMutability: "pure",
    inputs: [
      { name: "gasLimit", type: "uint32" },
      { name: "numCalls", type: "uint32" },
      { name: "maxFeePerGas", type: "uint256" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const scheduledJqFactoryAbi = [
  {
    type: "function",
    name: "consumerOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "consumer", type: "address" }],
  },
  {
    type: "function",
    name: "predictConsumer",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "consumer", type: "address" }],
  },
  {
    type: "function",
    name: "createConsumer",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "consumer", type: "address" }],
  },
] as const;

const ritualWalletAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [{ name: "lockDuration", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lockUntil",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const legacyHttpRunnerAbi = [
  {
    type: "event",
    name: "HttpResult",
    inputs: [
      { name: "caller", type: "address", indexed: true },
      { name: "statusCode", type: "uint16", indexed: false },
      { name: "body", type: "bytes", indexed: false },
      { name: "errorMessage", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "fetchHttp",
    stateMutability: "nonpayable",
    inputs: [{ name: "httpInput", type: "bytes" }],
    outputs: [
      {
        name: "response",
        type: "tuple",
        components: [
          { name: "statusCode", type: "uint16" },
          { name: "headerKeys", type: "string[]" },
          { name: "headerValues", type: "string[]" },
          { name: "body", type: "bytes" },
          { name: "errorMessage", type: "string" },
        ],
      },
    ],
  },
] as const;

const httpConsumerAbi = [
  {
    type: "event",
    name: "HttpResult",
    inputs: [
      { name: "caller", type: "address", indexed: true },
      { name: "statusCode", type: "uint16", indexed: false },
      { name: "bodyLength", type: "uint256", indexed: false },
      { name: "bodyHash", type: "bytes32", indexed: false },
      { name: "errorMessage", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "callHTTPCallRaw",
    stateMutability: "nonpayable",
    inputs: [{ name: "input", type: "bytes" }],
    outputs: [],
  },
] as const;

const llmConsumerAbi = [
  {
    type: "function",
    name: "callLlmRaw",
    stateMutability: "nonpayable",
    inputs: [{ name: "llmInput", type: "bytes" }],
    outputs: [
      { name: "hasError", type: "bool" },
      { name: "completionHash", type: "bytes32" },
      { name: "completionLength", type: "uint256" },
    ],
  },
] as const;

const teeServiceRegistryAbi = [
  {
    type: "function",
    name: "getServicesByCapability",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          {
            name: "node",
            type: "tuple",
            components: [
              { name: "paymentAddress", type: "address" },
              { name: "teeAddress", type: "address" },
              { name: "teeType", type: "uint8" },
              { name: "publicKey", type: "bytes" },
              { name: "endpoint", type: "string" },
              { name: "certPubKeyHash", type: "bytes32" },
              { name: "capability", type: "uint8" },
            ],
          },
          { name: "isValid", type: "bool" },
          { name: "workloadId", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

const asyncJobTrackerAbi = [
  {
    type: "function",
    name: "hasPendingJobForSender",
    stateMutability: "view",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const sovereignHarnessStatusAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "configured", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "wakeMode", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "activeCallId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentSeriesId", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
] as const;

export const recipes: Recipe[] = [
  {
    id: "http",
    name: "HTTP",
    label: "First live recipe",
    icon: Globe2,
    status: "live",
    description: "13-field HTTP input for precompile 0x0801.",
    fields: [
      { key: "executor", label: "Executor", value: zeroAddress },
      { key: "method", label: "Method", value: "GET", type: "select", options: Object.keys(HTTP_METHOD_IDS) },
      { key: "ttl", label: "TTL blocks", value: "30" },
      { key: "url", label: "URL", value: "https://httpbin.org/get" },
      { key: "headers", label: "Headers", value: "accept: application/json", type: "textarea" },
      { key: "body", label: "Body", value: "", type: "textarea" },
    ],
  },
  {
    id: "jq",
    name: "JQ",
    label: "Live sync recipe",
    icon: Code2,
    status: "live",
    description: "3-field JQ input for synchronous JSON extraction at precompile 0x0803.",
    fields: [
      { key: "query", label: "Query", value: ".data.price" },
      { key: "inputData", label: "Input JSON", value: "{\"data\":{\"price\":1979}}", type: "textarea" },
      { key: "outputType", label: "Output type", value: "uint256", type: "select", options: Object.keys(JQ_OUTPUT_TYPES) },
    ],
  },
  {
    id: "llm",
    name: "LLM",
    label: "Live chat recipe",
    icon: Wand2,
    status: "degraded",
    description: "30-field LLM input for GLM-4.7 chat completion at precompile 0x0802.",
    fields: [
      { key: "executor", label: "Executor", value: DEFAULT_LLM_EXECUTOR },
      { key: "ttl", label: "TTL blocks", value: "300" },
      {
        key: "messagesJson",
        label: "Messages JSON",
        value: '[{"role":"user","content":"Summarize why Ritual precompiles matter in one sentence."}]',
        type: "textarea",
      },
      { key: "model", label: "Model", value: DEFAULT_LLM_MODEL },
      { key: "maxCompletionTokens", label: "Max completion tokens", value: "4096" },
      { key: "temperature", label: "Temperature", value: "0.7" },
      { key: "stream", label: "Streaming", value: "false", type: "select", options: ["false", "true"] },
      { key: "historyPlatform", label: "History platform (optional)", value: "" },
      { key: "historyPath", label: "History path (optional)", value: "" },
      { key: "historyKeyRef", label: "History key ref (optional)", value: "" },
    ],
  },
  {
    id: "agent",
    name: "Agent",
    label: "Factory-backed recipe",
    icon: Route,
    status: "owner-only",
    description: "Factory-backed ZeroClaw task with authenticated two-phase delivery through the deployed harness.",
    fields: [
      { key: "executor", label: "Executor", value: zeroAddress },
      { key: "ttl", label: "TTL blocks", value: "500" },
      { key: "pollInterval", label: "Poll interval", value: "5" },
      { key: "maxPollBlock", label: "Max poll block", value: "6000" },
      { key: "taskIdMarker", label: "Task marker", value: "PRECOMPILE_STUDIO_AGENT" },
      { key: "callbackAddress", label: "Callback harness", value: SOVEREIGN_AGENT_HARNESS_ADDRESS },
      { key: "callbackSelector", label: "Callback selector", value: AGENT_CALLBACK_SELECTOR },
      { key: "gasLimit", label: "Callback gas", value: "3000000" },
      { key: "maxFeePerGas", label: "Max fee wei", value: "20000000000" },
      { key: "maxPriorityFeePerGas", label: "Priority fee wei", value: "1000000000" },
      { key: "cliType", label: "CLI type", value: "6", type: "select", options: ["6", "5", "0"] },
      {
        key: "prompt",
        label: "Prompt",
        value: "Explain what Ritual precompiles enable in two concise sentences.",
        type: "textarea",
      },
      { key: "encryptedSecrets", label: "Encrypted secrets", value: "0x", type: "textarea" },
      { key: "historyPlatform", label: "History platform (optional)", value: "" },
      { key: "historyPath", label: "History path (optional)", value: "" },
      { key: "historyKeyRef", label: "History key ref (optional)", value: "" },
      { key: "outputPlatform", label: "Output platform (optional)", value: "" },
      { key: "outputPath", label: "Output path (optional)", value: "" },
      { key: "outputKeyRef", label: "Output key ref (optional)", value: "" },
      { key: "skillsJson", label: "Skills refs JSON", value: "[]", type: "textarea" },
      { key: "systemPromptPlatform", label: "System platform", value: "" },
      { key: "systemPromptPath", label: "System path", value: "" },
      { key: "systemPromptKeyRef", label: "System key ref", value: "" },
      { key: "model", label: "Model", value: DEFAULT_LLM_MODEL },
      { key: "tools", label: "Allowed tools (optional)", value: "", type: "textarea" },
      { key: "maxTurns", label: "Max turns", value: "8" },
      { key: "maxTokens", label: "Max tokens", value: "4096" },
      { key: "rpcUrls", label: "RPC URLs (optional)", value: "", type: "textarea" },
    ],
  },
  {
    id: "scheduler",
    name: "Scheduled JQ",
    label: "Factory-backed recipe",
    icon: Activity,
    status: "live",
    description: "Run a JQ transform later or on a recurring Ritual schedule.",
    fields: [
      { key: "query", label: "JQ filter", value: ".data.price" },
      { key: "inputData", label: "Input JSON", value: '{"data":{"price":1979}}', type: "textarea" },
      { key: "outputType", label: "Output type", value: "uint256", type: "select", options: Object.keys(JQ_OUTPUT_TYPES) },
      { key: "frequency", label: "First run / frequency blocks", value: "20" },
      { key: "numCalls", label: "Executions", value: "1" },
      { key: "gas", label: "Callback gas limit", value: "200000" },
      { key: "ttl", label: "Execution window blocks", value: "100" },
      { key: "maxFeePerGas", label: "Max fee wei", value: "2000000000" },
    ],
  },
];

const builtInRecipePresets: RecipePreset[] = [
  {
    id: "example-http-echo",
    recipeId: "http",
    label: "Example: HTTP 200 echo",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("http", [
      { key: "executor", value: zeroAddress },
      { key: "method", value: "GET" },
      { key: "ttl", value: "30" },
      { key: "url", value: "https://httpbin.org/get" },
      { key: "headers", value: "accept: application/json" },
      { key: "body", value: "" },
    ]),
  },
  {
    id: "example-http-json-post",
    recipeId: "http",
    label: "Example: JSON POST body",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("http", [
      { key: "executor", value: zeroAddress },
      { key: "method", value: "POST" },
      { key: "ttl", value: "45" },
      { key: "url", value: "https://httpbin.org/post" },
      { key: "headers", value: "content-type: application/json" },
      { key: "body", value: "{\"hello\":\"ritual\"}" },
    ]),
  },
  {
    id: "example-jq-price",
    recipeId: "jq",
    label: "Example: Extract price",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("jq", [
      { key: "query", value: ".data.price" },
      { key: "inputData", value: "{\"data\":{\"price\":1979}}" },
      { key: "outputType", value: "uint256" },
    ]),
  },
  {
    id: "example-llm-summary",
    recipeId: "llm",
    label: "Example: One-line summary",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("llm", [
      { key: "executor", value: DEFAULT_LLM_EXECUTOR },
      { key: "ttl", value: "300" },
      {
        key: "messagesJson",
        value: '[{"role":"user","content":"Summarize why Ritual precompiles matter in one sentence."}]',
      },
      { key: "model", value: DEFAULT_LLM_MODEL },
      { key: "maxCompletionTokens", value: "4096" },
      { key: "temperature", value: "0.7" },
      { key: "stream", value: "false" },
      { key: "historyPlatform", value: "" },
      { key: "historyPath", value: "" },
      { key: "historyKeyRef", value: "" },
    ]),
  },
  {
    id: "example-agent-runner-audit",
    recipeId: "agent",
    label: "Example: Ritual ZeroClaw agent",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("agent", [
      { key: "executor", value: zeroAddress },
      { key: "ttl", value: "500" },
      { key: "pollInterval", value: "5" },
      { key: "maxPollBlock", value: "6000" },
      { key: "taskIdMarker", value: "PRECOMPILE_STUDIO_AGENT" },
      { key: "callbackAddress", value: SOVEREIGN_AGENT_HARNESS_ADDRESS },
      { key: "callbackSelector", value: AGENT_CALLBACK_SELECTOR },
      { key: "gasLimit", value: "3000000" },
      { key: "maxFeePerGas", value: "20000000000" },
      { key: "maxPriorityFeePerGas", value: "1000000000" },
      { key: "cliType", value: "6" },
      {
        key: "prompt",
        value: "Audit the latest runner trace and return the next onchain action as JSON.",
      },
      { key: "encryptedSecrets", value: "0x" },
      { key: "historyPlatform", value: "" },
      { key: "historyPath", value: "" },
      { key: "historyKeyRef", value: "" },
      { key: "outputPlatform", value: "" },
      { key: "outputPath", value: "" },
      { key: "outputKeyRef", value: "" },
      { key: "skillsJson", value: "[]" },
      { key: "systemPromptPlatform", value: "" },
      { key: "systemPromptPath", value: "" },
      { key: "systemPromptKeyRef", value: "" },
      { key: "model", value: DEFAULT_LLM_MODEL },
      { key: "tools", value: "" },
      { key: "maxTurns", value: "8" },
      { key: "maxTokens", value: "4096" },
      { key: "rpcUrls", value: "" },
    ]),
  },
  {
    id: "example-scheduler-price-check",
    recipeId: "scheduler",
    label: "Example: Scheduled price transform",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("scheduler", [
      { key: "query", value: ".data.price" },
      { key: "inputData", value: '{"data":{"price":1979}}' },
      { key: "outputType", value: "uint256" },
      { key: "frequency", value: "20" },
      { key: "numCalls", value: "1" },
      { key: "gas", value: "200000" },
      { key: "ttl", value: "100" },
      { key: "maxFeePerGas", value: "2000000000" },
    ]),
  },
];

const timeline = [
  { title: "Readiness", body: "RPC, wallet, chain, and escrow checks." },
  { title: "Encode", body: "ABI payload for the selected live precompile." },
  { title: "Submit", body: "Connected wallet signs the call." },
  { title: "Trace", body: "Receipt and callbacks stay attached." },
];

function formatAddress(address?: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNameList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatHash(hash?: string) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function isTransactionHash(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

function explorerTransactionUrl(hash: string) {
  return `${RITUAL.explorer}/tx/${hash}`;
}

function executorStorageKey(walletAddress?: string) {
  return `${EXECUTOR_STORAGE_PREFIX}:${walletAddress?.toLowerCase() ?? "local"}`;
}

function runnerStorageKey(walletAddress?: string) {
  return `${RUNNER_STORAGE_PREFIX}:${walletAddress?.toLowerCase() ?? "local"}`;
}

function runnerHistoryStorageKey(walletAddress?: string) {
  return `${RUNNER_HISTORY_STORAGE_PREFIX}:${walletAddress?.toLowerCase() ?? "local"}`;
}

function defaultRunnerLabel(address: string) {
  return `HTTP consumer ${formatAddress(address)}`;
}

function defaultExecutorLabel(address: string) {
  return `TEE executor ${formatAddress(address)}`;
}

function describeRunnerCodeState(state: RunnerCodeState) {
  if (state.status === "contract") return `${state.byteLength?.toLocaleString() ?? "Verified"} bytecode bytes`;
  if (state.status === "empty") return "No bytecode at this address.";
  if (state.status === "checking") return "Checking bytecode...";
  if (state.status === "error") return state.error ?? "Could not verify bytecode.";
  return "Set a consumer address to check bytecode.";
}

function formatBalance(hex?: string) {
  if (!hex) return "0";
  const value = BigInt(hex);
  const whole = value / 10n ** 18n;
  const fractional = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fractional}`;
}

function formatRitual(value: bigint) {
  const [whole, fraction = ""] = formatEther(value).split(".");
  const compactFraction = fraction.slice(0, 6).replace(/0+$/, "");
  return compactFraction ? `${whole}.${compactFraction}` : whole;
}

function decodeUintHex(hex?: string) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function decodeHexNumber(hex?: string) {
  if (!hex || hex === "0x") return undefined;
  return Number.parseInt(hex, 16);
}

export function receiptStatus(receipt?: RpcReceipt): ReceiptStatus {
  if (!receipt) return "pending";
  return receipt.status === "0x0" ? "failed" : "confirmed";
}

function describeSpcCalls(receipt?: RpcReceipt) {
  if (!receipt || receipt.spcCalls == null) return "No spcCalls yet";
  if (Array.isArray(receipt.spcCalls)) {
    return `${receipt.spcCalls.length} ${receipt.spcCalls.length === 1 ? "spcCall" : "spcCalls"}`;
  }
  return "spcCalls present";
}

function hasSpcCalls(receipt?: RpcReceipt) {
  if (!receipt || receipt.spcCalls == null) return false;
  return !Array.isArray(receipt.spcCalls) || receipt.spcCalls.length > 0;
}

function isRpcLog(value: unknown): value is RpcLog {
  if (!value || typeof value !== "object") return false;
  const log = value as RpcLog;
  return (
    (log.address === undefined || typeof log.address === "string") &&
    (log.data === undefined || typeof log.data === "string") &&
    (log.topics === undefined || (Array.isArray(log.topics) && log.topics.every((topic) => typeof topic === "string")))
  );
}

function isSpcCall(value: unknown): value is SpcCall {
  if (!value || typeof value !== "object") return false;
  const spcCall = value as SpcCall;
  return (
    (spcCall.address === undefined || typeof spcCall.address === "string") &&
    (spcCall.input === undefined || typeof spcCall.input === "string") &&
    (spcCall.output === undefined || typeof spcCall.output === "string")
  );
}

function hexByteLength(value?: string) {
  if (!value || !/^0x[a-fA-F0-9]*$/.test(value)) return undefined;
  return Math.max(0, Math.floor((value.length - 2) / 2));
}

function decodeHexText(value?: string) {
  if (!value || !/^0x[a-fA-F0-9]*$/.test(value) || value.length % 2 !== 0) return undefined;
  const hex = value.slice(2);
  if (!hex) return undefined;

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }

  const normalized = decoded.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  const printable = Array.from(normalized).filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 || code >= 32;
  });
  if (printable.length / Array.from(normalized).length < 0.9) return undefined;

  return normalized;
}

function decodeHexTextPreview(value?: string) {
  const normalized = decodeHexText(value);
  if (!normalized) return undefined;

  const truncated = normalized.length > CALLBACK_BODY_PREVIEW_LIMIT;
  return {
    text: truncated ? `${normalized.slice(0, CALLBACK_BODY_PREVIEW_LIMIT).trimEnd()}...` : normalized,
    truncated,
  };
}

function formatHttpBody(bodyText?: string, contentType?: string) {
  if (!bodyText) return undefined;
  if (contentType?.toLowerCase().includes("json") || /^[\[{]/.test(bodyText)) {
    try {
      return JSON.stringify(JSON.parse(bodyText), null, 2);
    } catch {
      // A server may label invalid JSON as JSON. Preserve the original body.
    }
  }
  return bodyText;
}

export function describeHttpPrecompileOutput(output?: string): RunnerCallbackEvidence | undefined {
  if (!output || !/^0x(?:[a-fA-F0-9]{2})*$/.test(output)) return undefined;

  try {
    const [statusCodeValue, headerKeys, headerValues, body, errorMessage] = decodeAbiParameters(
      parseAbiParameters("uint16, string[], string[], bytes, string"),
      output as `0x${string}`,
    );
    const statusCode = Number(statusCodeValue);
    const bodyBytes = hexByteLength(body);
    const bodyText = decodeHexText(body);
    const bodyPreview = decodeHexTextPreview(body);
    const headers = headerKeys.map((name, index) => ({ name, value: headerValues[index] ?? "" }));
    const contentTypeIndex = headerKeys.findIndex((key) => key.toLowerCase() === "content-type");
    const contentType = contentTypeIndex >= 0 ? headerValues[contentTypeIndex] : undefined;
    const status = errorMessage ? "precompile-error" : statusCode >= 400 ? "http-error" : "complete";
    const detailParts = [
      errorMessage ? "Precompile error" : undefined,
      `HTTP ${statusCode}`,
      headers.length ? `${headers.length} headers` : undefined,
      bodyBytes ? `${bodyBytes.toLocaleString()} bytes` : undefined,
      errorMessage || undefined,
    ].filter(Boolean);

    return {
      status,
      detail: detailParts.join(" · "),
      result: {
        statusCode,
        headers,
        contentType,
        bodyBytes,
        bodyText,
        bodyPreview: bodyPreview?.text,
        bodyPreviewTruncated: bodyPreview?.truncated || undefined,
        errorMessage: errorMessage || undefined,
      },
    };
  } catch {
    return undefined;
  }
}

export function describeLlmPrecompileOutput(output?: string): LlmPrecompileEvidence | undefined {
  if (!output || !/^0x(?:[a-fA-F0-9]{2})*$/.test(output)) return undefined;

  try {
    const [hasError, completionData, modelMetadata, errorMessage, updatedConvoHistory] = decodeAbiParameters(
      parseAbiParameters("bool, bytes, bytes, string, (string,string,string)"),
      output as `0x${string}`,
    );
    const completionBytes = hexByteLength(completionData) ?? 0;
    const metadataBytes = hexByteLength(modelMetadata) ?? 0;
    let completionText = decodeHexText(completionData);
    let completion: LlmPrecompileEvidence["result"]["completion"];
    let metadataText = decodeHexText(modelMetadata);
    let metadata: LlmPrecompileEvidence["result"]["metadata"];
    if (!hasError && completionData !== "0x") {
      try {
        const [id, , , completionModel, , , choicesCount, choicesData, usageData] = decodeAbiParameters(
          parseAbiParameters("string, string, uint256, string, string, string, uint256, bytes[], bytes"),
          completionData,
        );
        let role: string | undefined;
        let content: string | undefined;
        let finishReason: string | undefined;
        if (choicesCount > 0n && choicesData.length) {
          const [, decodedFinishReason, messageData] = decodeAbiParameters(
            parseAbiParameters("uint256, string, bytes"),
            choicesData[0],
          );
          [role, content] = decodeAbiParameters(
            parseAbiParameters("string, string, string, uint256, bytes[]"),
            messageData,
          );
          finishReason = decodedFinishReason;
          completionText = content;
        }
        const [promptTokens, completionTokens, totalTokens] = decodeAbiParameters(
          parseAbiParameters("uint256, uint256, uint256"),
          usageData,
        );
        completion = {
          id,
          model: completionModel,
          role,
          content,
          finishReason,
          promptTokens: promptTokens.toString(),
          completionTokens: completionTokens.toString(),
          totalTokens: totalTokens.toString(),
        };
      } catch {
        // Keep readable bytes as a fallback for non-standard executor output.
      }
    }
    if (modelMetadata !== "0x") {
      try {
        const [metadataModel, parameterCount, datatype, , maxSequenceLength] = decodeAbiParameters(
          parseAbiParameters("string, uint256, string, uint256, uint256"),
          modelMetadata,
        );
        metadata = {
          model: metadataModel,
          parameterCount: parameterCount.toString(),
          datatype,
          maxSequenceLength: maxSequenceLength.toString(),
        };
        metadataText = `${metadataModel} · ${datatype} · ${maxSequenceLength.toLocaleString()} context`;
      } catch {
        // Preserve readable metadata bytes when the executor returns another shape.
      }
    }
    const status = hasError || errorMessage ? "precompile-error" : "complete";
    const detail = [
      status === "complete" ? "LLM completion" : "LLM error",
      completionBytes ? `${completionBytes.toLocaleString()} completion bytes` : undefined,
      metadataBytes ? `${metadataBytes.toLocaleString()} metadata bytes` : undefined,
      errorMessage || undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      status,
      detail,
      result: {
        hasError,
        completionBytes,
        completionText,
        completion,
        metadataBytes,
        metadataText,
        metadata,
        errorMessage: errorMessage || undefined,
        updatedConvoHistory: [...updatedConvoHistory] as StorageRefTuple,
      },
    };
  } catch {
    return undefined;
  }
}

export function describeRunnerCallback(run: RunnerRun): RunnerCallbackEvidence {
  if (!run.receipt) {
    return {
      status: "pending",
      detail: "Available after receipt evidence",
    };
  }

  if (run.status === "failed") {
    return {
      status: "precompile-error",
      detail: "Transaction failed before callback",
    };
  }

  const spcCalls = Array.isArray(run.receipt.spcCalls) ? run.receipt.spcCalls.filter(isSpcCall) : [];
  for (const spcCall of spcCalls) {
    if (spcCall.address?.toLowerCase() !== HTTP_CALL_PRECOMPILE.toLowerCase()) continue;
    const evidence = describeHttpPrecompileOutput(spcCall.output);
    if (evidence) return evidence;
  }

  const logs = Array.isArray(run.receipt.logs) ? run.receipt.logs.filter(isRpcLog) : [];
  if (!logs.length) {
    return {
      status: "missing",
      detail: spcCalls.length ? "No HTTP output found" : "Receipt has no logs",
    };
  }

  const runnerAddress = run.runnerAddress.toLowerCase();
  const scopedLogs =
    runnerAddress === zeroAddress
      ? logs
      : logs.filter((log) => log.address?.toLowerCase() === runnerAddress);
  if (runnerAddress !== zeroAddress && !scopedLogs.length) {
    return {
      status: "missing",
      detail: "No consumer logs found",
    };
  }
  const candidateLogs = runnerAddress === zeroAddress ? logs : scopedLogs;

  for (const log of candidateLogs) {
    if (!log.data || !log.topics?.length) continue;
    try {
      const decoded = decodeEventLog({
        abi: httpConsumerAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "HttpResult") continue;

      const args = decoded.args as {
        caller?: string;
        statusCode?: number | bigint;
        bodyLength?: number | bigint;
        bodyHash?: string;
        errorMessage?: string;
      };
      const statusCode =
        typeof args.statusCode === "bigint"
          ? Number(args.statusCode)
          : typeof args.statusCode === "number"
            ? args.statusCode
            : undefined;
      const bodyBytes =
        typeof args.bodyLength === "bigint"
          ? Number(args.bodyLength)
          : typeof args.bodyLength === "number"
            ? args.bodyLength
            : undefined;
      const errorMessage = typeof args.errorMessage === "string" ? args.errorMessage : "";
      const status = errorMessage
        ? "precompile-error"
        : statusCode !== undefined && statusCode >= 400
          ? "http-error"
          : "complete";
      const detailParts = [
        statusCode === undefined ? "Consumer evidence emitted" : `HTTP ${statusCode}`,
        bodyBytes ? `${bodyBytes.toLocaleString()} bytes` : undefined,
        errorMessage || undefined,
      ].filter(Boolean);

      return {
        status,
        detail: detailParts.join(" · "),
        result: {
          caller: args.caller,
          statusCode,
          bodyBytes,
          errorMessage: errorMessage || undefined,
        },
      };
    } catch {
      // Fall through to the legacy event parser for imported older transactions.
    }

    try {
      const decoded = decodeEventLog({
        abi: legacyHttpRunnerAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "HttpResult") continue;

      const args = decoded.args as {
        caller?: string;
        statusCode?: number | bigint;
        body?: string;
        errorMessage?: string;
      };
      const statusCode =
        typeof args.statusCode === "bigint"
          ? Number(args.statusCode)
          : typeof args.statusCode === "number"
            ? args.statusCode
            : undefined;
      const bodyBytes = hexByteLength(args.body);
      const errorMessage = typeof args.errorMessage === "string" ? args.errorMessage : "";
      const bodyText = decodeHexText(args.body);
      const bodyPreview = decodeHexTextPreview(args.body);
      const status = errorMessage
        ? "precompile-error"
        : statusCode !== undefined && statusCode >= 400
          ? "http-error"
          : "complete";
      const detailParts = [
        statusCode === undefined ? "Callback emitted" : `HTTP ${statusCode}`,
        bodyBytes ? `${bodyBytes.toLocaleString()} bytes` : undefined,
        bodyPreview ? `"${bodyPreview.text}"` : undefined,
        errorMessage || undefined,
      ].filter(Boolean);

      return {
        status,
        detail: detailParts.join(" · "),
        result: {
          caller: args.caller,
          statusCode,
          bodyBytes,
          bodyText,
          bodyPreview: bodyPreview?.text,
          bodyPreviewTruncated: bodyPreview?.truncated || undefined,
          errorMessage: errorMessage || undefined,
        },
      };
    } catch {
      // Ignore unrelated logs. Receipts often include events from other contracts.
    }
  }

  return {
    status: "missing",
    detail: "No HTTP response evidence found",
  };
}

function formatSubmittedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function runnerTraceStages(run: RunnerRun) {
  const blockNumber = decodeHexNumber(run.receipt?.blockNumber);
  const gasUsed = decodeHexNumber(run.receipt?.gasUsed);
  const callback = describeRunnerCallback(run);
  const receiptDetail =
    run.status === "pending"
      ? "Waiting for receipt"
      : run.status === "failed"
        ? blockNumber
          ? `Failed in block ${blockNumber.toLocaleString()}`
          : "Receipt reports failure"
        : blockNumber
          ? `Block ${blockNumber.toLocaleString()}${gasUsed ? ` · ${gasUsed.toLocaleString()} gas` : ""}`
          : "Receipt confirmed";
  const spcDetail = describeSpcCalls(run.receipt);

  return [
    { label: "Submitted", tone: "ok" as const, detail: formatSubmittedAt(run.submittedAt) },
    {
      label: "Receipt",
      tone: run.status === "failed" ? ("bad" as const) : run.receipt ? ("ok" as const) : ("wait" as const),
      detail: receiptDetail,
    },
    {
      label: "spcCalls",
      tone: hasSpcCalls(run.receipt) ? ("ok" as const) : ("wait" as const),
      detail: spcDetail,
    },
    {
      label: callback.status === "precompile-error" ? "Precompile" : "HTTP response",
      tone:
        callback.status === "complete"
          ? ("ok" as const)
          : callback.status === "precompile-error"
            ? ("bad" as const)
            : ("wait" as const),
      detail: callback.detail,
    },
  ];
}

function runnerTraceJson(run: RunnerRun) {
  return JSON.stringify(
    {
      hash: run.hash,
      source: run.source ?? "wallet",
      runnerAddress: run.runnerAddress,
      submittedAt: new Date(run.submittedAt).toISOString(),
      request: {
        method: run.method,
        url: run.url,
      },
      explorerUrl: explorerTransactionUrl(run.hash),
      status: run.status,
      receipt: run.receipt ?? null,
      evidence: {
        spcCalls: run.receipt?.spcCalls ?? null,
        callback: describeRunnerCallback(run),
      },
    },
    null,
    2,
  );
}

function isRecipeId(value: string): value is RecipeId {
  return recipes.some((recipe) => recipe.id === value);
}

function normalizePresetFields(recipeId: RecipeId, fields: Array<Pick<ComposerField, "key" | "value">>) {
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!recipe) return [];
  return recipe.fields.map((baseField) => {
    const savedField = fields.find((field) => field.key === baseField.key);
    return {
      ...baseField,
      value: savedField?.value ?? baseField.value,
    };
  });
}

function parseSavedRunners(value: string | null): SavedRunner[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedRunner =>
          item &&
          typeof item === "object" &&
          "address" in item &&
          "label" in item &&
          typeof item.address === "string" &&
          typeof item.label === "string" &&
          isAddress(item.address),
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

function parseSavedExecutors(value: string | null): SavedExecutor[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedExecutor =>
          item &&
          typeof item === "object" &&
          "address" in item &&
          "label" in item &&
          typeof item.address === "string" &&
          typeof item.label === "string" &&
          isAddress(item.address),
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function parseRunnerRuns(value: string | null): RunnerRun[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RunnerRun => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Partial<RunnerRun>;
        const sourceOk =
          candidate.source === undefined || candidate.source === "wallet" || candidate.source === "imported";
        const receiptOk =
          candidate.receipt === undefined ||
          (candidate.receipt !== null &&
            typeof candidate.receipt === "object" &&
            typeof candidate.receipt.transactionHash === "string");
        return (
          typeof candidate.hash === "string" &&
          isTransactionHash(candidate.hash) &&
          typeof candidate.runnerAddress === "string" &&
          isAddress(candidate.runnerAddress) &&
          typeof candidate.submittedAt === "number" &&
          Number.isFinite(candidate.submittedAt) &&
          typeof candidate.method === "string" &&
          typeof candidate.url === "string" &&
          (candidate.status === "pending" || candidate.status === "confirmed" || candidate.status === "failed") &&
          sourceOk &&
          receiptOk
        );
      })
      .map((run) => ({
        hash: run.hash,
        runnerAddress: run.runnerAddress,
        submittedAt: run.submittedAt,
        method: run.method,
        url: run.url,
        source: run.source,
        status: run.status,
        receipt: run.receipt,
        error: typeof run.error === "string" ? run.error : undefined,
      }))
      .slice(0, RUNNER_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function parseRunnerHistoryImport(value: string): RunnerRun[] {
  try {
    const parsed = JSON.parse(value);
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.runs)
        ? parsed.runs
        : Array.isArray(parsed?.history)
          ? parsed.history
          : parsed?.run
            ? [parsed.run]
            : [];
    return parseRunnerRuns(JSON.stringify(candidates));
  } catch {
    return [];
  }
}

function parseRecipePresets(value: string | null): RecipePreset[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecipePreset =>
          item &&
          typeof item === "object" &&
          "id" in item &&
          "recipeId" in item &&
          "label" in item &&
          "fields" in item &&
          typeof item.id === "string" &&
          typeof item.recipeId === "string" &&
          isRecipeId(item.recipeId) &&
          typeof item.label === "string" &&
          Array.isArray(item.fields),
      )
      .map((preset) => ({
        ...preset,
        source: "local" as const,
        fields: normalizePresetFields(
          preset.recipeId,
          (preset.fields as unknown[]).filter(
            (field): field is Pick<ComposerField, "key" | "value"> =>
              field !== null &&
              typeof field === "object" &&
              "key" in field &&
              "value" in field &&
              typeof field.key === "string" &&
              typeof field.value === "string",
          ),
        ),
      }))
      .filter((preset) => preset.fields.length > 0)
      .slice(0, 24);
  } catch {
    return [];
  }
}

function parseRecipePresetImport(value: string): RecipePreset[] {
  try {
    const parsed = JSON.parse(value);
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.presets)
        ? parsed.presets
        : parsed?.preset
          ? [parsed.preset]
          : [parsed];
    return parseRecipePresets(JSON.stringify(candidates));
  } catch {
    return [];
  }
}

function parseHeaders(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (acc, line) => {
        const separator = line.indexOf(":");
        if (separator < 1) {
          acc.errors.push(`Header "${line}" needs "name: value" format.`);
          return acc;
        }
        acc.keys.push(line.slice(0, separator).trim());
        acc.values.push(line.slice(separator + 1).trim());
        return acc;
      },
      { keys: [] as string[], values: [] as string[], errors: [] as string[] },
    );
}

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "cookie",
  "set-cookie",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i;
const BEARER_PATTERN = /bearer\s+[A-Za-z0-9._~+/=-]{12,}/i;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}\b/;
const PRIVATE_KEY_HEX_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const PROVIDER_KEY_PATTERN = /\b(?:sk|pk|rk|ghp|github_pat|xoxb|xoxp|ya29)[-_][A-Za-z0-9._-]{16,}\b/i;

function detectSensitiveFields(fields: ComposerField[]) {
  return fields
    .filter((field) => {
      const value = field.value.trim();
      if (!value || value === "0x" || value === zeroAddress) return false;

      if (field.key.toLowerCase().includes("headers")) {
        const headerLines = value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (
          headerLines.some((line) => {
            const separator = line.indexOf(":");
            if (separator < 1) return false;
            const name = line.slice(0, separator).trim().toLowerCase();
            const headerValue = line.slice(separator + 1).trim();
            return SENSITIVE_HEADER_NAMES.has(name) && headerValue.length >= 8 && !/^<.*>$/.test(headerValue);
          })
        ) {
          return true;
        }
      }

      const fieldName = `${field.key} ${field.label}`.toLowerCase();
      return (
        BEARER_PATTERN.test(value) ||
        JWT_PATTERN.test(value) ||
        PROVIDER_KEY_PATTERN.test(value) ||
        SECRET_ASSIGNMENT_PATTERN.test(value) ||
        ((fieldName.includes("secret") || fieldName.includes("private")) && PRIVATE_KEY_HEX_PATTERN.test(value))
      );
    })
    .map((field) => field.label);
}

function parseStringList(input: string) {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUintField(value: string, label: string, errors: string[], options: { min?: bigint; max?: bigint } = {}) {
  const normalized = value.trim();
  const min = options.min ?? 0n;
  if (!/^\d+$/.test(normalized)) {
    errors.push(`${label} must be a whole number.`);
    return 0n;
  }

  const parsed = BigInt(normalized);
  if (parsed < min) errors.push(`${label} must be at least ${min.toString()}.`);
  if (options.max !== undefined && parsed > options.max) {
    errors.push(`${label} must fit within ${options.max.toString()}.`);
  }
  return parsed;
}

function parseHexBytesField(value: string, label: string, errors: string[], options: { byteLength?: number } = {}) {
  const normalized = value.trim() || "0x";
  if (!/^0x[a-fA-F0-9]*$/.test(normalized) || normalized.length % 2 !== 0) {
    errors.push(`${label} must be 0x-prefixed hex bytes.`);
    return "0x";
  }
  if (options.byteLength !== undefined && (normalized.length - 2) / 2 !== options.byteLength) {
    errors.push(`${label} must be ${options.byteLength} bytes.`);
  }
  return normalized;
}

function walletErrorCodes(error: unknown, seen = new Set<unknown>()): Array<number | string> {
  if (!error || typeof error !== "object" || seen.has(error)) return [];
  seen.add(error);

  const codes: Array<number | string> = [];
  const candidate = error as {
    cause?: unknown;
    code?: number | string;
    data?: unknown;
    error?: unknown;
    originalError?: unknown;
  };

  if (candidate.code !== undefined) codes.push(candidate.code);
  codes.push(...walletErrorCodes(candidate.data, seen));
  codes.push(...walletErrorCodes(candidate.error, seen));
  codes.push(...walletErrorCodes(candidate.originalError, seen));
  codes.push(...walletErrorCodes(candidate.cause, seen));
  return codes;
}

function isUnknownChainError(error: unknown) {
  const codes = walletErrorCodes(error).map((code) => String(code));
  if (codes.includes("4902")) return true;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /unrecognized chain|unknown chain|chain.*not.*added/i.test(message);
}

function walletErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  // EIP-1193 providers throw plain { code, message } objects, not Error
  // instances, so pull the message out of those (and nested data/cause) too.
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; data?: unknown; cause?: unknown };
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    for (const nested of [candidate.data, candidate.cause]) {
      if (nested && typeof nested === "object") {
        const message = (nested as { message?: unknown }).message;
        if (typeof message === "string" && message) return message;
      }
    }
  }
  return fallback;
}

function isUserRejectedWalletError(error: unknown) {
  const codes = walletErrorCodes(error).map((code) => String(code));
  if (codes.includes("4001")) return true;
  const message = walletErrorMessage(error, "").toLowerCase();
  return message.includes("user rejected") || message.includes("user denied") || message.includes("rejected by user");
}

function shouldUseSignedRawFallback(error: unknown, provider: Eip1193Provider | undefined) {
  if (isUserRejectedWalletError(error)) return false;
  const message = walletErrorMessage(error, "").toLowerCase();
  return (
    message.includes("transaction type not supported") ||
    (isRabbyProvider(provider) && message.includes("fail to create")) ||
    (isRabbyProvider(provider) && message.includes("simulation not supported"))
  );
}

function extractSignedTransaction(result: unknown) {
  if (typeof result === "string" && result.startsWith("0x")) return result;
  if (result && typeof result === "object") {
    const candidate = result as { raw?: unknown; rawTransaction?: unknown; signedTransaction?: unknown };
    for (const value of [candidate.raw, candidate.rawTransaction, candidate.signedTransaction]) {
      if (typeof value === "string" && value.startsWith("0x")) return value;
    }
  }
  throw new Error("Wallet did not return a signed transaction.");
}

function assertEvenHexData(value: string | undefined, label: string) {
  if (value === undefined) return;
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(value)) {
    throw new Error(`${label} must be an even-length 0x hex string before it can be sent.`);
  }
}

async function signTransactionWithWallet(provider: Eip1193Provider, tx: WalletTransactionRequest) {
  try {
    return extractSignedTransaction(await provider.request({ method: "eth_signTransaction", params: [tx] }));
  } catch (firstError) {
    try {
      return extractSignedTransaction(await provider.request({ method: "wallet_signTransaction", params: [tx] }));
    } catch (secondError) {
      throw new Error(
        walletErrorMessage(
          secondError,
          walletErrorMessage(firstError, "Wallet cannot sign this transaction without broadcasting it."),
        ),
      );
    }
  }
}

async function sendSignedRawTransaction(provider: Eip1193Provider, tx: WalletTransactionRequest) {
  const signedTransaction = await signTransactionWithWallet(provider, tx);
  try {
    return await rpc<string>("eth_sendRawTransaction", [signedTransaction]);
  } catch (broadcastError) {
    throw new Error(
      `Wallet signed the transaction, but Ritual RPC could not broadcast it: ${walletErrorMessage(
        broadcastError,
        "broadcast failed",
      )}`,
    );
  }
}

export async function sendWalletTransaction(
  provider: Eip1193Provider,
  tx: WalletTransactionRequest,
  options: SendWalletTransactionOptions = {},
) {
  assertEvenHexData(tx.data, "Transaction data");
  if (options.signFirst) return sendSignedRawTransaction(provider, tx);

  try {
    return await provider.request<string>({
      method: "eth_sendTransaction",
      params: [tx],
    });
  } catch (sendError) {
    if (!shouldUseSignedRawFallback(sendError, provider)) throw sendError;
    if (isRabbyProvider(provider)) {
      throw new Error(
        "Rabby downgrades Ritual transactions to a legacy type the RPC rejects, and won't sign them for manual broadcast. Send with MetaMask (it uses EIP-1559 on Ritual) or run the copied `cast send` command.",
      );
    }
    return sendSignedRawTransaction(provider, tx);
  }
}

export async function requestWalletAccounts(provider: Eip1193Provider) {
  return provider.request<string[]>({ method: "eth_requestAccounts" });
}

export async function ensureRitualChain(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: RITUAL.chainHex }],
    });
    return "switched" as const;
  } catch (switchError) {
    if (!isUnknownChainError(switchError)) throw switchError;
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [RITUAL_CHAIN_PARAMS],
  });
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: RITUAL.chainHex }],
  });
  return "added" as const;
}

export function createRitualDepositTransaction(
  from: string,
  value: bigint,
  lockDuration: bigint,
): WalletTransactionRequest {
  return {
    from,
    to: SYSTEM_CONTRACTS.RitualWallet,
    value: `0x${value.toString(16)}`,
    data: encodeFunctionData({
      abi: ritualWalletAbi,
      functionName: "deposit",
      args: [lockDuration],
    }),
  };
}

export function createLlmConsumerTransaction(
  from: string,
  encodedInput: `0x${string}`,
): WalletTransactionRequest {
  return {
    from,
    to: LLM_PRECOMPILE_CONSUMER_ADDRESS,
    data: encodeFunctionData({
      abi: llmConsumerAbi,
      functionName: "callLlmRaw",
      args: [encodedInput],
    }),
  };
}

export function createAgentHarnessTransaction(
  from: string,
  draft: ReturnType<typeof buildAgentDraft>,
  schedulerFunding: bigint,
  lockDuration = AGENT_LOCK_BLOCKS,
): WalletTransactionRequest {
  if (!draft.encodedInput || draft.errors.length || !draft.values) {
    throw new Error("Resolve the Sovereign Agent input before configuring the harness.");
  }
  if (draft.callbackAddress.toLowerCase() !== SOVEREIGN_AGENT_HARNESS_ADDRESS.toLowerCase()) {
    throw new Error("Agent delivery target must be the deployed Sovereign Agent harness.");
  }
  if (schedulerFunding <= 0n) throw new Error("Harness funding must be greater than zero.");

  const encodedArgs = encodeAbiParameters(parseAbiParameters(AGENT_HARNESS_CONFIG_SIGNATURE), [
    draft.values,
    AGENT_SCHEDULE,
    AGENT_ROLLING,
    lockDuration,
  ] as never);
  return {
    from,
    to: SOVEREIGN_AGENT_HARNESS_ADDRESS,
    value: `0x${schedulerFunding.toString(16)}`,
    data: concatHex([AGENT_CONFIGURE_SELECTOR, encodedArgs]),
  };
}

export function createSchedulerTransaction(
  from: string,
  draft: ReturnType<typeof buildScheduleDraft>,
  funding = 0n,
  consumerAddress = SCHEDULED_JQ_CONSUMER_ADDRESS,
): WalletTransactionRequest {
  if (!draft.encodedInput || draft.errors.length) {
    throw new Error("Resolve the Scheduled JQ input before creating the schedule.");
  }
  if (!isAddress(consumerAddress) || consumerAddress.toLowerCase() === zeroAddress) {
    throw new Error("Create a Scheduled JQ consumer before creating the schedule.");
  }
  if (funding === 0n) return { from, to: consumerAddress, data: draft.encodedInput };
  return {
    from,
    to: consumerAddress,
    value: `0x${funding.toString(16)}`,
    data: encodeFunctionData({
      abi: scheduledJqConsumerAbi,
      functionName: "fundAndSchedule",
      args: [
        draft.query,
        draft.inputData,
        draft.outputType,
        Number(draft.frequency),
        Number(draft.numCalls),
        Number(draft.gasLimit),
        Number(draft.ttl),
        draft.maxFeePerGas,
        SCHEDULER_LOCK_BLOCKS,
      ],
    }),
  };
}

export function createSchedulerControlTransaction(
  from: string,
  action: "cancelSchedule" | "withdraw",
  amount?: bigint,
  consumerAddress = SCHEDULED_JQ_CONSUMER_ADDRESS,
): WalletTransactionRequest {
  if (!isAddress(consumerAddress) || consumerAddress.toLowerCase() === zeroAddress) {
    throw new Error("Create a Scheduled JQ consumer before managing the schedule.");
  }
  return {
    from,
    to: consumerAddress,
    data: encodeFunctionData({
      abi: scheduledJqConsumerAbi,
      functionName: action,
      args: action === "withdraw" ? [amount ?? 0n] : [],
    } as never),
  };
}

export function createScheduledJqConsumerTransaction(from: string): WalletTransactionRequest {
  return {
    from,
    to: SCHEDULED_JQ_FACTORY_ADDRESS,
    data: encodeFunctionData({
      abi: scheduledJqFactoryAbi,
      functionName: "createConsumer",
    }),
  };
}

export type ScheduledJqConsumerDiscovery =
  | { status: "ready"; address: string }
  | { status: "missing"; predictedAddress: string };

export async function readScheduledJqConsumerDiscovery(
  owner: string,
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
): Promise<ScheduledJqConsumerDiscovery> {
  const address = await readViewFunction<string>(
    SCHEDULED_JQ_FACTORY_ADDRESS,
    scheduledJqFactoryAbi,
    "consumerOf",
    [owner],
    requester,
  );
  if (address.toLowerCase() !== zeroAddress) return { status: "ready", address };
  const predictedAddress = await readViewFunction<string>(
    SCHEDULED_JQ_FACTORY_ADDRESS,
    scheduledJqFactoryAbi,
    "predictConsumer",
    [owner],
    requester,
  );
  return { status: "missing", predictedAddress };
}

function schedulerOriginTransactionStorageKey(consumerAddress: string) {
  return `${SCHEDULER_ORIGIN_TX_STORAGE_PREFIX}:${consumerAddress.toLowerCase()}`;
}

export type AgentHarnessStatus = {
  owner: string;
  configured: boolean;
  wakeMode: number;
  activeCallId: string;
  currentSeriesId: string;
  senderLocked: boolean;
};

async function readViewFunction<T>(
  address: string,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = [],
  requester: <R>(method: string, params?: unknown[]) => Promise<R> = rpc,
) {
  const data = encodeFunctionData({ abi: abi as never, functionName, args } as never);
  const raw = await requester<string>("eth_call", [{ to: address, data }, "latest"]);
  return decodeFunctionResult({ abi: abi as never, functionName, data: raw as `0x${string}` } as never) as T;
}

function schedulerLifecycleDetail(eventName: string, args: Record<string, unknown>) {
  switch (eventName) {
    case "CallScheduled": {
      const numCalls = Number(args.numCalls);
      const frequency = Number(args.frequency);
      return {
        kind: "scheduled" as const,
        label: "Schedule created",
        detail: `${numCalls} ${numCalls === 1 ? "execution" : "executions"}, first at block ${Number(args.startBlock).toLocaleString()}${numCalls > 1 ? ` and every ${frequency.toLocaleString()} blocks` : ""}.`,
        tone: "neutral" as const,
      };
    }
    case "CallExecuted":
      return {
        kind: "executed" as const,
        label: `Execution ${Number(args.executionIndex) + 1} completed`,
        detail: `${Number(args.gasUsed).toLocaleString()} gas used; ${formatRitual(BigInt(args.feesPaid as bigint))} RITUAL paid.`,
        tone: "ok" as const,
      };
    case "CallCompleted":
      return {
        kind: "completed" as const,
        label: "Schedule completed",
        detail: `${Number(args.totalExecutions).toLocaleString()} ${Number(args.totalExecutions) === 1 ? "execution" : "executions"} finished.`,
        tone: "ok" as const,
      };
    case "CallExecutionFailed":
      return {
        kind: "failed" as const,
        label: `Execution ${Number(args.executionIndex) + 1} failed`,
        detail: String(args.reason || "The callback reverted without a reason."),
        tone: "bad" as const,
      };
    case "CallSkippedInsufficientFunds":
      return {
        kind: "skipped-funds" as const,
        label: "Execution skipped",
        detail: `Escrow had ${formatRitual(BigInt(args.availableAmount as bigint))} of ${formatRitual(BigInt(args.requiredAmount as bigint))} RITUAL required.`,
        tone: "warning" as const,
      };
    case "CallSkippedTTLExpired":
      return {
        kind: "skipped-ttl" as const,
        label: "Execution window missed",
        detail: `Expected near block ${Number(args.expectedBlock).toLocaleString()}, executed at ${Number(args.currentBlock).toLocaleString()} after the ${Number(args.ttl).toLocaleString()}-block window.`,
        tone: "warning" as const,
      };
    case "CallExpired":
      return {
        kind: "expired" as const,
        label: "Schedule expired",
        detail: `Expired at block ${Number(args.expiredAtBlock).toLocaleString()} after its block ${Number(args.expiryBlock).toLocaleString()} deadline.`,
        tone: "bad" as const,
      };
    case "CallCancelled":
      return {
        kind: "cancelled" as const,
        label: "Schedule cancelled",
        detail: `The remaining ${Number(args.numCalls).toLocaleString()} configured ${Number(args.numCalls) === 1 ? "execution was" : "executions were"} cancelled.`,
        tone: "warning" as const,
      };
    default:
      throw new Error(`Unsupported Scheduler lifecycle event: ${eventName}`);
  }
}

export async function readSchedulerLifecycle(
  callId: bigint,
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
  originTransactionHash?: string,
  consumerAddress = SCHEDULED_JQ_CONSUMER_ADDRESS,
  deploymentBlock = SCHEDULED_JQ_DEPLOYMENT_BLOCK,
): Promise<SchedulerLifecycleEntry[]> {
  if (callId === 0n) return [];
  const callIdTopic = encodeAbiParameters(parseAbiParameters("uint256"), [callId]);
  // Ritual RPC currently returns an empty result for topic OR filters. Query
  // each lifecycle signature separately, then reconcile the small result set.
  const logGroups = await Promise.all(SCHEDULER_LIFECYCLE_TOPICS.map((topic) =>
    requester<RpcLog[]>("eth_getLogs", [{
      address: SYSTEM_CONTRACTS.Scheduler,
      fromBlock: `0x${deploymentBlock.toString(16)}`,
      toBlock: "latest",
      topics: [topic, callIdTopic],
    }]),
  ));
  const logs = logGroups.flat();
  const recoveredEntries: SchedulerLifecycleEntry[] = [];

  const smokeRun = SCHEDULED_JQ_SMOKE_RUNS.find((run) =>
    run.consumer.toLowerCase() === consumerAddress.toLowerCase() && run.callId === callId,
  );
  const knownOriginTransaction = originTransactionHash ?? smokeRun?.transaction;
  if (logs.length === 0 && knownOriginTransaction) {
    const readReceipt = async (hash: string) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const receipt = await requester<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
        if (receipt) return receipt;
      }
      return undefined;
    };
    const originReceipt = await readReceipt(knownOriginTransaction);
    const originLogs = (originReceipt?.logs ?? []) as RpcLog[];
    const normalizedCallIdTopic = callIdTopic.toLowerCase();
    const scheduledTopic = SCHEDULER_LIFECYCLE_TOPICS[0].toLowerCase();
    const scheduledLog = originLogs.find((log) =>
      log.address?.toLowerCase() === SYSTEM_CONTRACTS.Scheduler.toLowerCase()
      && log.topics?.[0]?.toLowerCase() === scheduledTopic
      && log.topics?.[1]?.toLowerCase() === normalizedCallIdTopic,
    );
    let startBlock: number | undefined;
    let frequency: number | undefined;
    let numCalls: number | undefined;
    if (scheduledLog) {
      logs.push(scheduledLog);
      try {
        const scheduled = decodeEventLog({
          abi: schedulerLifecycleAbi,
          data: (scheduledLog.data ?? "0x") as `0x${string}`,
          topics: (scheduledLog.topics ?? []) as [`0x${string}`, ...`0x${string}`[]],
        });
        const args = scheduled.args as Record<string, unknown>;
        startBlock = Number(args.startBlock);
        frequency = Number(args.frequency);
        numCalls = Math.min(Number(args.numCalls), 32);
      } catch {
        // The consumer state still provides the terminal outcome.
      }
    } else if (smokeRun) {
      startBlock = smokeRun.startBlock;
      frequency = smokeRun.frequency;
      numCalls = smokeRun.numCalls;
      recoveredEntries.push({
        kind: "scheduled",
        label: "Schedule created",
        detail: `${numCalls} execution, first at block ${startBlock.toLocaleString()}.`,
        tone: "neutral",
        blockNumber: smokeRun.block,
        transactionHash: smokeRun.transaction,
      });
    }
    if (startBlock !== undefined && frequency !== undefined && numCalls !== undefined) {
      try {
        const latestBlock = Number(BigInt(await requester<string>("eth_blockNumber")));
        const expectedBlocks = Array.from({ length: numCalls }, (_, index) => startBlock + frequency * index)
          .filter((blockNumber) => blockNumber <= latestBlock);
        const blocks = await Promise.all(expectedBlocks.map((blockNumber) =>
          requester<{ transactions?: Array<string | { hash?: string; to?: string; callId?: number | string; index?: number | string }> } | null>(
            "eth_getBlockByNumber",
            [`0x${blockNumber.toString(16)}`, true],
          ),
        ));
        const schedulerTransactions = blocks.flatMap((block, blockIndex) => (block?.transactions ?? []).flatMap((transaction) => {
          if (typeof transaction === "string") return [];
          const transactionCallId = transaction.callId === undefined ? undefined : BigInt(transaction.callId);
          return transaction.to?.toLowerCase() === SYSTEM_CONTRACTS.Scheduler.toLowerCase()
            && transaction.hash
            && (transactionCallId === undefined || transactionCallId === callId)
            ? [{ ...transaction, blockNumber: expectedBlocks[blockIndex] }]
            : [];
        }));
        const executionReceipts = await Promise.all(schedulerTransactions.map((transaction) => readReceipt(transaction.hash!)));
        executionReceipts.forEach((receipt, index) => {
          const matchingLogs = ((receipt?.logs ?? []) as RpcLog[]).filter((log) => {
            if (
              log.address?.toLowerCase() === SYSTEM_CONTRACTS.Scheduler.toLowerCase()
              && log.topics?.[1]?.toLowerCase() === normalizedCallIdTopic
            ) return true;
            return false;
          });
          logs.push(...matchingLogs);
          if (matchingLogs.length === 0 && schedulerTransactions[index].callId !== undefined) {
            const executionIndex = Number(schedulerTransactions[index].index ?? index);
            recoveredEntries.push({
              kind: "executed",
              label: `Execution ${executionIndex + 1} recorded`,
              detail: "Scheduler execution transaction included onchain; detailed receipt events have aged out of the RPC window.",
              tone: "neutral",
              blockNumber: schedulerTransactions[index].blockNumber,
              transactionHash: schedulerTransactions[index].hash,
            });
          }
        });
      } catch {
        // The creation event is still useful when an archival block read is unavailable.
      }
    }
  }

  const decodedEntries = logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({
        abi: schedulerLifecycleAbi,
        data: (log.data ?? "0x") as `0x${string}`,
        topics: (log.topics ?? []) as [`0x${string}`, ...`0x${string}`[]],
      });
      const summary = schedulerLifecycleDetail(decoded.eventName, decoded.args as Record<string, unknown>);
      return [{
        ...summary,
        blockNumber: decodeHexNumber(log.blockNumber),
        transactionHash: log.transactionHash,
      }];
    } catch {
      return [];
    }
  });
  const recoveredWithoutDuplicates = recoveredEntries.filter((recovered) => !decodedEntries.some((decoded) =>
    decoded.kind === recovered.kind && decoded.blockNumber === recovered.blockNumber,
  ));
  return [...decodedEntries, ...recoveredWithoutDuplicates]
    .sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));
}

export async function readScheduledJqConsumerStatus(
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
  originTransactionHash?: string,
  consumerAddress = SCHEDULED_JQ_CONSUMER_ADDRESS,
  deploymentBlock = SCHEDULED_JQ_DEPLOYMENT_BLOCK,
): Promise<ScheduledJqConsumerStatus> {
  const [
    owner,
    balance,
    lockUntil,
    activeScheduleId,
    lastScheduleId,
    scheduleState,
    executionCount,
    lastExecutionIndex,
    activeNumCalls,
    lastResult,
  ] = await Promise.all([
    readViewFunction<string>(consumerAddress, scheduledJqConsumerAbi, "owner", [], requester),
    readViewFunction<bigint>(consumerAddress, scheduledJqConsumerAbi, "consumerBalance", [], requester),
    readViewFunction<bigint>(SYSTEM_CONTRACTS.RitualWallet, ritualWalletAbi, "lockUntil", [consumerAddress], requester),
    readViewFunction<bigint>(consumerAddress, scheduledJqConsumerAbi, "activeScheduleId", [], requester),
    readViewFunction<bigint>(consumerAddress, scheduledJqConsumerAbi, "lastScheduleId", [], requester),
    readViewFunction<number>(consumerAddress, scheduledJqConsumerAbi, "activeScheduleState", [], requester),
    readViewFunction<bigint>(consumerAddress, scheduledJqConsumerAbi, "executionCount", [], requester),
    readViewFunction<bigint>(consumerAddress, scheduledJqConsumerAbi, "lastExecutionIndex", [], requester),
    readViewFunction<number>(consumerAddress, scheduledJqConsumerAbi, "activeNumCalls", [], requester),
    readViewFunction<`0x${string}`>(consumerAddress, scheduledJqConsumerAbi, "lastResult", [], requester),
  ]);
  const lifecycle = await readSchedulerLifecycle(
    lastScheduleId,
    requester,
    originTransactionHash,
    consumerAddress,
    deploymentBlock,
  );
  const latestEvidence = lifecycle[lifecycle.length - 1];
  if (lastScheduleId !== 0n && executionCount > 0n && !lifecycle.some((entry) => entry.kind === "executed")) {
    lifecycle.push({
      kind: "executed",
      label: `Execution ${Number(lastExecutionIndex) + 1} completed`,
      detail: "The consumer recorded and decoded the Scheduler callback onchain.",
      tone: "ok",
    });
  }
  if (lastScheduleId !== 0n && scheduleState === 2 && !lifecycle.some((entry) => entry.kind === "completed")) {
    lifecycle.push({
      kind: "completed",
      label: "Schedule completed",
      detail: `${executionCount.toString()} ${executionCount === 1n ? "execution" : "executions"} confirmed by the consumer contract.`,
      tone: "ok",
      blockNumber: latestEvidence?.blockNumber,
      transactionHash: latestEvidence?.transactionHash,
    });
  }
  if (lastScheduleId !== 0n && scheduleState === 3 && !lifecycle.some((entry) => entry.kind === "cancelled")) {
    lifecycle.push({
      kind: "cancelled",
      label: "Schedule cancelled",
      detail: "Cancellation confirmed by the consumer contract.",
      tone: "warning",
    });
  }
  if (lastScheduleId !== 0n && scheduleState === 4 && !lifecycle.some((entry) => entry.kind === "expired")) {
    lifecycle.push({
      kind: "expired",
      label: "Schedule expired",
      detail: "Expiry confirmed by the consumer contract.",
      tone: "bad",
    });
  }
  return {
    address: consumerAddress,
    owner,
    balance,
    lockUntil,
    activeScheduleId,
    lastScheduleId,
    scheduleState,
    executionCount,
    lastExecutionIndex,
    activeNumCalls,
    lastResult,
    lifecycle,
  };
}

export async function readAgentHarnessStatus(
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
): Promise<AgentHarnessStatus> {
  const [owner, configured, wakeMode, activeCallId, currentSeriesId, senderLocked] = await Promise.all([
    readViewFunction<string>(SOVEREIGN_AGENT_HARNESS_ADDRESS, sovereignHarnessStatusAbi, "owner", [], requester),
    readViewFunction<boolean>(SOVEREIGN_AGENT_HARNESS_ADDRESS, sovereignHarnessStatusAbi, "configured", [], requester),
    readViewFunction<number>(SOVEREIGN_AGENT_HARNESS_ADDRESS, sovereignHarnessStatusAbi, "wakeMode", [], requester),
    readViewFunction<bigint>(SOVEREIGN_AGENT_HARNESS_ADDRESS, sovereignHarnessStatusAbi, "activeCallId", [], requester),
    readViewFunction<bigint>(SOVEREIGN_AGENT_HARNESS_ADDRESS, sovereignHarnessStatusAbi, "currentSeriesId", [], requester),
    readViewFunction<boolean>(SYSTEM_CONTRACTS.AsyncJobTracker, asyncJobTrackerAbi, "hasPendingJobForSender", [SOVEREIGN_AGENT_HARNESS_ADDRESS], requester),
  ]);
  return {
    owner,
    configured,
    wakeMode,
    activeCallId: activeCallId.toString(),
    currentSeriesId: currentSeriesId.toString(),
    senderLocked,
  };
}

export function decodeSovereignAgentResult(result: `0x${string}`) {
  const [success, error, text, convoHistory, output, artifacts] = decodeAbiParameters(
    parseAbiParameters("bool, string, string, (string,string,string), (string,string,string), (string,string,string)[]"),
    result,
  );
  return { success, error, text, convoHistory, output, artifacts };
}

function addressTopic(address: string) {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

function newestLog(logs: RpcLog[]) {
  return [...logs].sort((a, b) => Number(BigInt(b.blockNumber ?? "0x0") - BigInt(a.blockNumber ?? "0x0")))[0];
}

export async function readAgentLifecycle(
  configured: boolean,
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
): Promise<AgentLifecycle> {
  const fromBlock = `0x${AGENT_DEPLOYMENT_BLOCK.toString(16)}`;
  const jobLogs = await requester<RpcLog[]>("eth_getLogs", [{
    address: SYSTEM_CONTRACTS.AsyncJobTracker,
    fromBlock,
    toBlock: "latest",
    topics: [JOB_ADDED_TOPIC, null, null, addressTopic(SOVEREIGN_AGENT_PRECOMPILE)],
  }]);
  const matchingJobs = jobLogs.filter((log) => {
    try {
      const decoded = decodeAbiParameters(
        parseAbiParameters("uint256, bytes, address, bytes32, uint256, uint256, uint256, uint256"),
        log.data as `0x${string}`,
      );
      return decoded[2].toLowerCase() === SOVEREIGN_AGENT_HARNESS_ADDRESS.toLowerCase();
    } catch {
      return false;
    }
  });
  const jobLog = newestLog(matchingJobs);
  const jobId = jobLog?.topics?.[2];
  if (!jobLog || !jobId) return { status: configured ? "scheduled" : "idle" };

  const [commitBlock] = decodeAbiParameters(
    parseAbiParameters("uint256, bytes, address, bytes32, uint256, uint256, uint256, uint256"),
    jobLog.data as `0x${string}`,
  );
  const [phase1Logs, resultLogs, removedLogs, harnessResultLogs] = await Promise.all([
    requester<RpcLog[]>("eth_getLogs", [{
      address: SYSTEM_CONTRACTS.AsyncJobTracker,
      fromBlock,
      toBlock: "latest",
      topics: [PHASE1_SETTLED_TOPIC, jobId],
    }]),
    requester<RpcLog[]>("eth_getLogs", [{
      address: SYSTEM_CONTRACTS.AsyncJobTracker,
      fromBlock,
      toBlock: "latest",
      topics: [RESULT_DELIVERED_TOPIC, jobId, addressTopic(SOVEREIGN_AGENT_HARNESS_ADDRESS)],
    }]),
    requester<RpcLog[]>("eth_getLogs", [{
      address: SYSTEM_CONTRACTS.AsyncJobTracker,
      fromBlock,
      toBlock: "latest",
      topics: [JOB_REMOVED_TOPIC, null, jobId],
    }]),
    requester<RpcLog[]>("eth_getLogs", [{
      address: SOVEREIGN_AGENT_HARNESS_ADDRESS,
      fromBlock,
      toBlock: "latest",
      topics: [SOVEREIGN_RESULT_TOPIC],
    }]),
  ]);
  const phase1Log = newestLog(phase1Logs);
  const resultLog = newestLog(resultLogs);
  const removedLog = newestLog(removedLogs);
  const harnessResultLog = newestLog(harnessResultLogs.filter((log) => {
    if (log.topics?.[1]?.toLowerCase() === jobId.toLowerCase()) return true;
    if (log.topics?.length !== 1 || !log.data) return false;
    try {
      const [decodedJobId] = decodeAbiParameters(parseAbiParameters("bytes32, bytes"), log.data as `0x${string}`);
      return decodedJobId.toLowerCase() === jobId.toLowerCase();
    } catch {
      return false;
    }
  }));

  let decodedResult: ReturnType<typeof decodeSovereignAgentResult> | undefined;
  let decodeError: string | undefined;
  if (harnessResultLog?.data) {
    try {
      const resultBytes = harnessResultLog.topics?.length === 1
        ? decodeAbiParameters(parseAbiParameters("bytes32, bytes"), harnessResultLog.data as `0x${string}`)[1]
        : decodeAbiParameters(parseAbiParameters("bytes"), harnessResultLog.data as `0x${string}`)[0];
      decodedResult = decodeSovereignAgentResult(resultBytes);
    } catch {
      decodeError = "The callback arrived, but its Agent result tuple could not be decoded.";
    }
  }

  const base = {
    jobId,
    executor: jobLog.topics?.[1] ? `0x${jobLog.topics[1].slice(-40)}` : undefined,
    commitBlock: Number(commitBlock),
    transactionHash: harnessResultLog?.transactionHash ?? resultLog?.transactionHash ?? jobLog.transactionHash,
    result: decodedResult,
    error: decodeError,
  };
  if (removedLog?.topics?.[3] && BigInt(removedLog.topics[3]) === 0n) return { ...base, status: "expired" };
  if (resultLog?.data) {
    const [success] = decodeAbiParameters(parseAbiParameters("bool"), resultLog.data as `0x${string}`);
    return { ...base, status: success && decodedResult?.success !== false ? "settled" : "failed" };
  }
  if (decodedResult) return { ...base, status: decodedResult.success ? "settled" : "failed" };
  if (phase1Log?.data) {
    const [settledBlock] = decodeAbiParameters(parseAbiParameters("uint256"), phase1Log.data as `0x${string}`);
    return { ...base, status: "result-ready", settledBlock: Number(settledBlock) };
  }
  return { ...base, status: "committed" };
}

function storageRefFromFields(fields: ComposerField[], prefix: string): StorageRefTuple {
  return [
    fieldValue(fields, `${prefix}Platform`).trim(),
    fieldValue(fields, `${prefix}Path`).trim(),
    fieldValue(fields, `${prefix}KeyRef`).trim(),
  ];
}

function parseStorageRefList(input: string, errors: string[]) {
  const trimmed = input.trim();
  if (!trimmed) return [] as StorageRefTuple[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    errors.push("Skills refs JSON must parse as an array.");
    return [] as StorageRefTuple[];
  }

  if (!Array.isArray(parsed)) {
    errors.push("Skills refs JSON must be an array.");
    return [] as StorageRefTuple[];
  }

  const refs: StorageRefTuple[] = [];
  parsed.forEach((item, index) => {
    if (Array.isArray(item) && item.length === 3 && item.every((value) => typeof value === "string")) {
      refs.push([item[0], item[1], item[2]]);
      return;
    }
    if (
      item &&
      typeof item === "object" &&
      "platform" in item &&
      "path" in item &&
      "keyRef" in item &&
      typeof item.platform === "string" &&
      typeof item.path === "string" &&
      typeof item.keyRef === "string"
    ) {
      refs.push([item.platform, item.path, item.keyRef]);
      return;
    }
    errors.push(`Skills ref ${index + 1} must be [platform, path, keyRef] or { platform, path, keyRef }.`);
  });

  return refs;
}

function fieldValue(fields: ComposerField[], key: string) {
  return fields.find((field) => field.key === key)?.value ?? "";
}

export function buildHttpDraft(fields: ComposerField[]) {
  const executor = fieldValue(fields, "executor").trim();
  const method = fieldValue(fields, "method").trim();
  const ttlRaw = fieldValue(fields, "ttl").trim();
  const url = fieldValue(fields, "url").trim();
  const body = fieldValue(fields, "body");
  const headers = parseHeaders(fieldValue(fields, "headers"));
  const errors = [...headers.errors];
  const methodId = HTTP_METHOD_IDS[method] ?? 1;
  const ttl = Number.parseInt(ttlRaw, 10);

  if (!isAddress(executor)) errors.push("Executor must be a valid address from TEEServiceRegistry.");
  if (executor.toLowerCase() === zeroAddress) errors.push("Select a non-zero TEE executor before sending.");
  if (!Number.isFinite(ttl) || ttl <= 0) errors.push("TTL must be a positive block count.");
  if (!url.startsWith("https://")) errors.push("HTTP precompile requests should use an https:// URL.");

  const bodyHex = body.trim() ? stringToHex(body) : "0x";
  const canEncode =
    isAddress(executor) &&
    executor.toLowerCase() !== zeroAddress &&
    Number.isFinite(ttl) &&
    ttl > 0 &&
    url.length > 0 &&
    errors.length === 0;
  const encodedInput = canEncode
    ? encodeAbiParameters(parseAbiParameters(HTTP_ABI_SIGNATURE), [
        executor,
        [],
        BigInt(ttl),
        [],
        "0x",
        url,
        methodId,
        headers.keys,
        headers.values,
        bodyHex,
        0n,
        0,
        false,
      ])
    : undefined;

  return {
    precompile: "0x0801",
    callTarget: HTTP_CALL_PRECOMPILE,
    abi: HTTP_ABI_SIGNATURE,
    methodId,
    ttl,
    headerKeys: headers.keys,
    headerValues: headers.values,
    bodyHex,
    encodedInput,
    errors,
  };
}

export function buildLlmDraft(fields: ComposerField[]) {
  const executor = fieldValue(fields, "executor").trim();
  const ttlValue = fieldValue(fields, "ttl").trim();
  const ttl = Number(ttlValue);
  const messagesJson = fieldValue(fields, "messagesJson").trim();
  const model = fieldValue(fields, "model").trim();
  const maxCompletionTokens = Number(fieldValue(fields, "maxCompletionTokens").trim());
  const temperatureValue = fieldValue(fields, "temperature").trim();
  const temperature = Number(temperatureValue);
  const stream = fieldValue(fields, "stream").trim() === "true";
  const historyPlatform = fieldValue(fields, "historyPlatform").trim();
  const historyPath = fieldValue(fields, "historyPath").trim();
  const historyKeyRef = fieldValue(fields, "historyKeyRef").trim();
  const errors: string[] = [];

  if (!isAddress(executor) || executor.toLowerCase() === zeroAddress) {
    errors.push("Select a non-zero TEE executor before encoding.");
  }
  if (!Number.isFinite(ttl) || ttl <= 0 || !Number.isInteger(ttl)) {
    errors.push("TTL must be a positive whole number.");
  }
  if (!messagesJson) {
    errors.push("Messages JSON is required.");
  } else {
    try {
      const messages = JSON.parse(messagesJson);
      if (!Array.isArray(messages) || messages.length === 0) {
        errors.push("Messages JSON must be a non-empty array.");
      }
    } catch {
      errors.push("Messages JSON must parse before encoding.");
    }
  }
  if (!model) errors.push("Model is required.");
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    errors.push("Temperature must be between 0 and 2.");
  }
  if (stream) {
    errors.push("Streaming uses a separate capability and SSE service; this verified consumer flow is non-streaming only.");
  }
  if (!Number.isInteger(maxCompletionTokens) || maxCompletionTokens < 1) {
    errors.push("Max completion tokens must be a positive whole number.");
  }
  const historyParts = [historyPlatform, historyPath, historyKeyRef];
  if (historyParts.some(Boolean) && !historyParts.every(Boolean)) {
    errors.push("Conversation history must include platform, path, and key ref, or leave all three empty.");
  }

  const temperatureScaled = Number.isFinite(temperature) ? BigInt(Math.round(temperature * 1000)) : 0n;
  const encodedInput =
    errors.length === 0
      ? encodeAbiParameters(parseAbiParameters(LLM_ABI_SIGNATURE), [
          executor as `0x${string}`,
          [],
          BigInt(ttl),
          [],
          "0x",
          messagesJson,
          model,
          0n,
          "",
          false,
          BigInt(maxCompletionTokens),
          "",
          "",
          1n,
          true,
          0n,
          "medium",
          "0x",
          -1n,
          "auto",
          "",
          stream,
          temperatureScaled,
          "0x",
          "0x",
          -1n,
          1000n,
          "",
          false,
          [historyPlatform, historyPath, historyKeyRef],
        ])
      : undefined;

  return {
    precompile: "0x0802",
    callTarget: LLM_INFERENCE_PRECOMPILE,
    abi: LLM_ABI_SIGNATURE,
    executor,
    ttl,
    messagesJson,
    model,
    stream,
    temperature,
    temperatureScaled,
    maxCompletionTokens,
    convoHistory: [historyPlatform, historyPath, historyKeyRef] as const,
    encodedInput,
    errors,
  };
}

export function buildJqDraft(fields: ComposerField[]) {
  const query = fieldValue(fields, "query").trim();
  const inputData = fieldValue(fields, "inputData").trim();
  const outputTypeKey = fieldValue(fields, "outputType").trim();
  const outputType = JQ_OUTPUT_TYPES[outputTypeKey];
  const errors: string[] = [];

  if (!query) errors.push("JQ query is required.");
  if (!inputData) {
    errors.push("Input JSON is required.");
  } else {
    try {
      JSON.parse(inputData);
    } catch {
      errors.push("Input JSON must parse before encoding.");
    }
  }
  if (outputType === undefined) errors.push("Choose a supported JQ output type.");

  const encodedInput =
    errors.length === 0
      ? encodeAbiParameters(parseAbiParameters(JQ_ABI_SIGNATURE), [query, inputData, outputType])
      : undefined;

  return {
    precompile: "0x0803",
    callTarget: JQ_PRECOMPILE,
    abi: JQ_ABI_SIGNATURE,
    query,
    inputData,
    outputTypeKey,
    outputType,
    encodedInput,
    errors,
  };
}

export function decodeJqOutput(raw: string, outputTypeKey: string): JqDecodedOutput {
  if (JQ_OUTPUT_TYPES[outputTypeKey] === undefined) {
    throw new Error(`Unsupported JQ output type: ${outputTypeKey}`);
  }
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(raw)) throw new Error("JQ returned malformed hex output.");
  if (raw === "0x") throw new Error("JQ returned no output.");

  let encoded = raw as `0x${string}`;
  if (JQ_DYNAMIC_OUTPUT_TYPES.has(outputTypeKey)) {
    const outerOffset = raw.slice(2, 66);
    const innerOffset = raw.slice(66, 130);
    const offsetWord = "0".repeat(62) + "20";
    if (outerOffset !== offsetWord || innerOffset !== offsetWord) {
      throw new Error("JQ returned an invalid dynamic output envelope.");
    }
    encoded = `0x${raw.slice(66)}`;
  }

  let decoded: unknown;
  try {
    [decoded] = decodeAbiParameters(parseAbiParameters(outputTypeKey), encoded);
  } catch {
    throw new Error(`JQ output could not be decoded as ${outputTypeKey}.`);
  }

  const value = Array.isArray(decoded)
    ? decoded.map((item) => (typeof item === "bigint" ? item.toString() : item))
    : typeof decoded === "bigint"
      ? decoded.toString()
      : decoded;
  if (typeof value !== "string" && typeof value !== "boolean" && !Array.isArray(value)) {
    throw new Error(`JQ returned an unsupported ${outputTypeKey} value.`);
  }
  const isEmpty = value === "" || (Array.isArray(value) && value.length === 0);
  const display = Array.isArray(value) ? JSON.stringify(value, null, 2) : String(value);
  return { outputType: outputTypeKey, value, display, isEmpty, raw };
}

export async function runJqCall(
  encodedInput: `0x${string}`,
  outputTypeKey: string,
  requester: <T>(method: string, params?: unknown[]) => Promise<T> = rpc,
) {
  const raw = await requester<string>("eth_call", [
    { to: JQ_PRECOMPILE, data: encodedInput },
    "latest",
  ]);
  if (raw === "0x") return { status: "empty" as const, raw };
  return { status: "success" as const, result: decodeJqOutput(raw, outputTypeKey) };
}

export function buildAgentDraft(fields: ComposerField[]) {
  const executor = fieldValue(fields, "executor").trim();
  const errors: string[] = [];
  const ttl = parseUintField(fieldValue(fields, "ttl"), "TTL", errors, { min: 1n });
  const pollInterval = parseUintField(fieldValue(fields, "pollInterval"), "Poll interval", errors, { min: 1n });
  const maxPollBlock = parseUintField(fieldValue(fields, "maxPollBlock"), "Max poll block", errors, { min: 1n });
  const taskIdMarker = fieldValue(fields, "taskIdMarker").trim();
  const callbackAddress = fieldValue(fields, "callbackAddress").trim();
  const callbackSelector = parseHexBytesField(fieldValue(fields, "callbackSelector"), "Callback selector", errors, {
    byteLength: 4,
  });
  const gasLimit = parseUintField(fieldValue(fields, "gasLimit"), "Callback gas", errors, { min: 1n });
  const maxFeePerGas = parseUintField(fieldValue(fields, "maxFeePerGas"), "Max fee wei", errors);
  const maxPriorityFeePerGas = parseUintField(fieldValue(fields, "maxPriorityFeePerGas"), "Priority fee wei", errors);
  const cliType = parseUintField(fieldValue(fields, "cliType"), "CLI type", errors, { max: 65535n });
  const prompt = fieldValue(fields, "prompt").trim();
  const encryptedSecrets = parseHexBytesField(fieldValue(fields, "encryptedSecrets"), "Encrypted secrets", errors);
  const convoHistory = storageRefFromFields(fields, "history");
  const output = storageRefFromFields(fields, "output");
  const skills = parseStorageRefList(fieldValue(fields, "skillsJson"), errors);
  const systemPrompt = storageRefFromFields(fields, "systemPrompt");
  const model = fieldValue(fields, "model").trim();
  const tools = parseStringList(fieldValue(fields, "tools"));
  const maxTurns = parseUintField(fieldValue(fields, "maxTurns"), "Max turns", errors, { min: 1n, max: 65535n });
  const maxTokens = parseUintField(fieldValue(fields, "maxTokens"), "Max tokens", errors, { min: 1n, max: 4294967295n });
  const rpcUrls = fieldValue(fields, "rpcUrls").trim();

  if (!isAddress(executor) || executor.toLowerCase() === zeroAddress) {
    errors.push("Select a non-zero TEE executor before encoding.");
  }
  if (!isAddress(callbackAddress) || callbackAddress.toLowerCase() === zeroAddress) {
    errors.push("Set the contract callback address for two-phase delivery.");
  } else if (callbackAddress.toLowerCase() !== SOVEREIGN_AGENT_HARNESS_ADDRESS.toLowerCase()) {
    errors.push("Callback target must be the deployed Sovereign Agent harness.");
  }
  if (callbackSelector === "0x00000000") {
    errors.push("Callback selector should point to onSovereignAgentResult(bytes32,bytes).");
  }
  if (!prompt) errors.push("Prompt is required.");
  if (convoHistory.some(Boolean) && !convoHistory.every(Boolean)) {
    errors.push("Conversation history needs platform, path, and key ref, or all three fields must be empty.");
  }
  if (output.some(Boolean) && !output.every(Boolean)) {
    errors.push("Output storage needs platform, path, and key ref, or all three fields must be empty.");
  }
  if (!model) errors.push("Model is required.");
  if (![0n, 5n, 6n].includes(cliType)) errors.push("CLI type must be 0 (Claude Code), 5 (Crush), or 6 (ZeroClaw).");
  if (maxPollBlock <= ttl) errors.push("Max poll block must be greater than TTL for two-phase delivery.");
  if (maxPollBlock > 70_000n) errors.push("Max poll block cannot exceed 70,000.");

  const values = [
    executor as `0x${string}`,
    ttl,
    "0x",
    pollInterval,
    maxPollBlock,
    taskIdMarker,
    callbackAddress as `0x${string}`,
    callbackSelector as `0x${string}`,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    Number(cliType),
    prompt,
    encryptedSecrets as `0x${string}`,
    convoHistory,
    output,
    skills,
    systemPrompt,
    model,
    tools,
    Number(maxTurns),
    Number(maxTokens),
    rpcUrls,
  ] as const;

  const encodedInput =
    errors.length === 0
      ? encodeAbiParameters(parseAbiParameters(SOVEREIGN_AGENT_ABI_SIGNATURE), values)
      : undefined;

  return {
    precompile: "0x080C",
    callTarget: SOVEREIGN_AGENT_PRECOMPILE,
    abi: SOVEREIGN_AGENT_ABI_SIGNATURE,
    executor,
    ttl,
    pollInterval,
    maxPollBlock,
    callbackAddress,
    callbackSelector,
    cliType,
    prompt,
    encryptedSecrets,
    convoHistory,
    output,
    skills,
    systemPrompt,
    model,
    tools,
    maxTurns,
    maxTokens,
    rpcUrls,
    values,
    encodedInput,
    errors,
  };
}

export function buildScheduleDraft(fields: ComposerField[]) {
  const errors: string[] = [];
  const query = fieldValue(fields, "query").trim();
  const inputData = fieldValue(fields, "inputData").trim();
  const outputTypeKey = fieldValue(fields, "outputType").trim();
  const outputType = JQ_OUTPUT_TYPES[outputTypeKey];
  const gasLimit = parseUintField(fieldValue(fields, "gas"), "Gas limit", errors, { min: 1n, max: 4294967295n });
  const numCalls = parseUintField(fieldValue(fields, "numCalls"), "Executions", errors, { min: 1n, max: 4294967295n });
  const frequency = parseUintField(fieldValue(fields, "frequency"), "Frequency", errors, { min: 1n, max: 4294967295n });
  const ttl = parseUintField(fieldValue(fields, "ttl"), "TTL", errors, { min: 1n, max: 500n });
  const maxFeePerGas = parseUintField(fieldValue(fields, "maxFeePerGas"), "Max fee wei", errors, { min: 1n });

  if (!query) errors.push("Enter a JQ filter.");
  try {
    JSON.parse(inputData);
  } catch {
    errors.push("Input JSON must be valid JSON.");
  }
  if (outputType === undefined) errors.push("Select a supported JQ output type.");
  if (frequency * numCalls > 10_000n) errors.push("Frequency × executions must not exceed 10,000 blocks.");

  const requiredBalance = SCHEDULER_RESERVE + gasLimit * maxFeePerGas * numCalls;

  const encodedInput =
    errors.length === 0
      ? encodeFunctionData({
          abi: scheduledJqConsumerAbi,
          functionName: "scheduleTransform",
          args: [
            query,
            inputData,
            outputType,
            Number(frequency),
            Number(numCalls),
            Number(gasLimit),
            Number(ttl),
            maxFeePerGas,
          ],
        })
      : undefined;

  return {
    precompile: "Scheduled JQ",
    callTarget: SCHEDULED_JQ_CONSUMER_ADDRESS,
    abi: "scheduleTransform(string jqFilter,string inputJson,uint8 outputType,uint32 frequency,uint32 numCalls,uint32 gasLimit,uint32 ttl,uint256 maxFeePerGas)",
    query,
    inputData,
    outputTypeKey,
    outputType,
    gasLimit,
    numCalls,
    frequency,
    ttl,
    maxFeePerGas,
    requiredBalance,
    encodedInput,
    errors,
  };
}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(RITUAL.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "RPC request failed");
  return payload.result as T;
}

function encodeUint256(value: number | bigint) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function decodeUintResult(result: string) {
  return Number(decodeUintHex(result));
}

function decodeAddressResult(result: string) {
  return `0x${result.slice(-40)}`;
}

async function discoverExecutors(capabilityId: number): Promise<{ executors: DiscoveredExecutor[]; total: number }> {
  const data = encodeFunctionData({
    abi: teeServiceRegistryAbi,
    functionName: "getServicesByCapability",
    args: [capabilityId, true],
  });
  const raw = await rpc<string>("eth_call", [
    { to: SYSTEM_CONTRACTS.TEEServiceRegistry, data },
    "latest",
  ]);
  const services = decodeFunctionResult({
    abi: teeServiceRegistryAbi,
    functionName: "getServicesByCapability",
    data: raw as `0x${string}`,
  });
  return {
    total: services.length,
    executors: services.slice(0, 12).map((service) => ({
      address: service.node.teeAddress,
      capabilityId,
      publicKey: service.node.publicKey,
      isValid: service.isValid,
    })),
  };
}

// `gasFloor` is a *minimum* gas limit, not just a fallback. eth_estimateGas
// cannot run Ritual's async precompiles (the TEE HTTP/LLM round-trip never
// happens during estimation), so it badly under-reports — a real HTTP call
// needs ~157k+ but estimates ~97k. Trusting the estimate makes the tx die
// out-of-gas, so we always take the larger of the estimate and the floor.
export async function prepareWalletTransaction(tx: WalletTransactionRequest, gasFloor: string): Promise<WalletTransactionRequest> {
  const [maxPriorityFeePerGas, gasPrice, nonce] = await Promise.all([
    rpc<string>("eth_maxPriorityFeePerGas").catch(() => undefined),
    rpc<string>("eth_gasPrice"),
    rpc<string>("eth_getTransactionCount", [tx.from, "pending"]),
  ]);
  const priorityFee = maxPriorityFeePerGas ?? gasPrice;
  const feeCap = `0x${(BigInt(gasPrice) + BigInt(priorityFee) + 20_000_000_000n).toString(16)}`;
  const feeTx: WalletTransactionRequest = {
    ...tx,
    chainId: RITUAL.chainHex,
    type: "0x2",
    value: tx.value ?? "0x0",
    nonce,
    maxFeePerGas: feeCap,
    maxPriorityFeePerGas: priorityFee,
  };
  delete feeTx.gasPrice;

  try {
    const estimate = await rpc<string>("eth_estimateGas", [feeTx]);
    const gas = BigInt(estimate) > BigInt(gasFloor) ? estimate : gasFloor;
    return { ...feeTx, gas };
  } catch {
    return { ...feeTx, gas: gasFloor };
  }
}

function App() {
  const [route, setRoute] = React.useState(() => (window.location.pathname === "/faq" ? "faq" : "studio"));
  const [rpcState, setRpcState] = React.useState<RpcState>({ status: "checking" });
  const [wallet, setWallet] = React.useState<WalletState>({ status: "idle" });
  const [activeRecipe, setActiveRecipe] = React.useState<RecipeId>("http");
  const [showAbiDetails, setShowAbiDetails] = React.useState(false);
  const [showRequestPreview, setShowRequestPreview] = React.useState(false);
  const [showRunPath, setShowRunPath] = React.useState(false);
  const [showContracts, setShowContracts] = React.useState(false);
  const [showFunding, setShowFunding] = React.useState(true);
  const [showPresetTransfer, setShowPresetTransfer] = React.useState(false);
  const [showRunnerSetup, setShowRunnerSetup] = React.useState(false);
  const [presetLabel, setPresetLabel] = React.useState("");
  const [presetImportValue, setPresetImportValue] = React.useState("");
  const [presetTransferMessage, setPresetTransferMessage] = React.useState("");
  const [copiedPresetJson, setCopiedPresetJson] = React.useState(false);
  const [selectedPresetId, setSelectedPresetId] = React.useState("");
  const [recipePresets, setRecipePresets] = React.useState<RecipePreset[]>([]);
  const [depositAmount, setDepositAmount] = React.useState("0.01");
  const [depositLockBlocks, setDepositLockBlocks] = React.useState("100000");
  const [depositState, setDepositState] = React.useState<DepositState>({ status: "idle" });
  const [executorLabel, setExecutorLabel] = React.useState("");
  const [savedExecutors, setSavedExecutors] = React.useState<SavedExecutor[]>([]);
  const [executorDiscovery, setExecutorDiscovery] = React.useState<ExecutorDiscoveryState>({
    status: "idle",
    capabilityId: defaultCapabilityForRecipe("http"),
    executors: [],
  });
  const [runnerAddress, setRunnerAddress] = React.useState(DEFAULT_HTTP_RUNNER_ADDRESS);
  const [runnerLabel, setRunnerLabel] = React.useState("");
  const [savedRunners, setSavedRunners] = React.useState<SavedRunner[]>([]);
  const [importTxHash, setImportTxHash] = React.useState("");
  const [importTxState, setImportTxState] = React.useState<ImportState>({ status: "idle" });
  const [showRunnerHistoryTransfer, setShowRunnerHistoryTransfer] = React.useState(false);
  const [runnerHistoryImportValue, setRunnerHistoryImportValue] = React.useState("");
  const [runnerHistoryMessage, setRunnerHistoryMessage] = React.useState("");
  const [runnerHistoryFilter, setRunnerHistoryFilter] = React.useState<RunnerHistoryFilter>("all");
  const [copiedRunnerHistory, setCopiedRunnerHistory] = React.useState(false);
  const [runnerTxState, setRunnerTxState] = React.useState<TransactionState>({ status: "idle" });
  const [llmTxState, setLlmTxState] = React.useState<TransactionState>({ status: "idle" });
  const [llmRun, setLlmRun] = React.useState<LlmRun | undefined>();
  const [agentTxState, setAgentTxState] = React.useState<TransactionState>({ status: "idle" });
  const [agentRun, setAgentRun] = React.useState<AgentRun | undefined>();
  const [agentHarnessState, setAgentHarnessState] = React.useState<AgentHarnessState>({ status: "idle" });
  const [agentLifecycleState, setAgentLifecycleState] = React.useState<AgentLifecycleState>({ status: "idle" });
  const [agentFundingAmount, setAgentFundingAmount] = React.useState("5");
  const [scheduledJqState, setScheduledJqState] = React.useState<ScheduledJqConsumerState>({ status: "idle" });
  const [schedulerTxState, setSchedulerTxState] = React.useState<SchedulerTransactionState>({ status: "idle" });
  const [runnerCodeState, setRunnerCodeState] = React.useState<RunnerCodeState>({ status: "idle" });
  const [isSwitchingChain, setIsSwitchingChain] = React.useState(false);
  const initialRunnerHistoryScope = React.useMemo(() => runnerHistoryStorageKey(), []);
  const [runnerHistoryScope, setRunnerHistoryScope] = React.useState(initialRunnerHistoryScope);
  const [runnerRuns, setRunnerRuns] = React.useState<RunnerRun[]>(() =>
    parseRunnerRuns(window.localStorage.getItem(initialRunnerHistoryScope)),
  );
  const runnerHistoryHydrated = React.useRef(true);
  const [copiedRunnerCalldata, setCopiedRunnerCalldata] = React.useState(false);
  const [fieldState, setFieldState] = React.useState<Record<RecipeId, ComposerField[]>>(() =>
    recipes.reduce(
      (acc, recipe) => ({ ...acc, [recipe.id]: recipe.fields }),
      {} as Record<RecipeId, ComposerField[]>,
    ),
  );
  const [copied, setCopied] = React.useState(false);
  const [copiedEncoded, setCopiedEncoded] = React.useState(false);
  const [copiedCallRequest, setCopiedCallRequest] = React.useState(false);
  const [copiedCastCommand, setCopiedCastCommand] = React.useState(false);
  const [jqCallState, setJqCallState] = React.useState<JqCallState>({ status: "idle" });
  const [copyFeedback, setCopyFeedback] = React.useState<CopyFeedback | undefined>();
  const copyFeedbackTimer = React.useRef<number | undefined>(undefined);
  const chainSwitchingRef = React.useRef(false);
  const chainSwitchAccountRef = React.useRef<string | undefined>(undefined);
  const [injectedWallets, setInjectedWallets] = React.useState<EIP6963ProviderDetail[]>([]);
  const [showWalletPicker, setShowWalletPicker] = React.useState(false);
  const [pickedProvider, setPickedProvider] = React.useState<Eip1193Provider | undefined>(undefined);
  const providerRef = React.useRef<Eip1193Provider | undefined>(window.ethereum);

  // Once the user connects a specific wallet, keep using it. Only fall back to
  // the auto-pick (Rabby, then MetaMask) before an explicit choice.
  const getProvider = React.useCallback(
    () => pickedProvider ?? pickInjectedProvider(injectedWallets),
    [pickedProvider, injectedWallets],
  );

  React.useEffect(() => {
    providerRef.current = getProvider();
  }, [getProvider]);

  React.useEffect(() => {
    const handleAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!detail?.info?.rdns || !detail.provider) return;
      setInjectedWallets((current) => {
        if (current.some((wallet) => wallet.info.rdns === detail.info.rdns)) return current;
        return [...current, detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
  }, []);

  const selectedRecipe = recipes.find((recipe) => recipe.id === activeRecipe) ?? recipes[0];
  const liveRecipeLabel = React.useMemo(
    () => formatNameList(recipes.filter((recipe) => recipe.status === "live").map((recipe) => recipe.name)),
    [],
  );
  const selectedFields = fieldState[selectedRecipe.id];
  const activeRecipePresets = React.useMemo(
    () => recipePresets.filter((preset) => preset.recipeId === selectedRecipe.id),
    [recipePresets, selectedRecipe.id],
  );
  const activeBuiltInPresets = React.useMemo(
    () => builtInRecipePresets.filter((preset) => preset.recipeId === selectedRecipe.id),
    [selectedRecipe.id],
  );
  const visibleRecipePresets = React.useMemo(
    () => [...activeBuiltInPresets, ...activeRecipePresets],
    [activeBuiltInPresets, activeRecipePresets],
  );
  const selectedPreset = visibleRecipePresets.find((preset) => preset.id === selectedPresetId);
  const httpDraft = React.useMemo(() => buildHttpDraft(fieldState.http), [fieldState.http]);
  const llmDraft = React.useMemo(() => buildLlmDraft(fieldState.llm), [fieldState.llm]);
  const jqDraft = React.useMemo(() => buildJqDraft(fieldState.jq), [fieldState.jq]);
  const agentDraft = React.useMemo(() => buildAgentDraft(fieldState.agent), [fieldState.agent]);
  const scheduleDraft = React.useMemo(() => buildScheduleDraft(fieldState.scheduler), [fieldState.scheduler]);
  const sensitiveFieldLabels = React.useMemo(() => detectSensitiveFields(selectedFields), [selectedFields]);
  const liveAbiDraft =
    selectedRecipe.id === "http"
      ? httpDraft
      : selectedRecipe.id === "llm"
        ? llmDraft
        : selectedRecipe.id === "jq"
          ? jqDraft
          : selectedRecipe.id === "agent"
            ? agentDraft
            : selectedRecipe.id === "scheduler"
              ? scheduleDraft
              : undefined;
  const isRightChain = wallet.chainId === RITUAL.chainId;
  const isReady = rpcState.status === "online" && wallet.status === "connected" && isRightChain;
  const isPreviewRecipe = selectedRecipe.status === "preview";
  // Async precompile payloads (HTTP/LLM/agent) require the RitualWallet escrow
  // to stay locked into the future to cover the callback. A funded-but-expired
  // lock still gets rejected by the node with "insufficient lock duration", so
  // the readiness gate has to check the lock, not just the balance.
  const hasRitualBalance = Number.parseFloat(wallet.ritualWalletBalance ?? "0") > 0;
  const ritualLockRemaining =
    wallet.ritualLockUntil !== undefined && rpcState.block !== undefined
      ? wallet.ritualLockUntil - rpcState.block
      : undefined;
  const isRitualLockSufficient =
    ritualLockRemaining === undefined ? true : ritualLockRemaining >= RITUAL_ASYNC_LOCK_MARGIN;
  const isRitualWalletFunded = hasRitualBalance && isRitualLockSufficient;
  const hasExecutorField = selectedFields.some((field) => field.key === "executor");
  const depositLock = Number.parseInt(depositLockBlocks, 10);
  const depositAmountValid = (() => {
    try {
      return parseEther(depositAmount || "0") > 0n;
    } catch {
      return false;
    }
  })();
  const canDeposit =
    wallet.status === "connected" &&
    isRightChain &&
    depositAmountValid &&
    Number.isFinite(depositLock) &&
    depositLock > 0 &&
    depositState.status !== "submitting";
  const scheduledJqStatus = scheduledJqState.status === "ready" ? scheduledJqState.data : undefined;
  const scheduledJqConsumerAddress =
    scheduledJqState.status === "ready"
      ? scheduledJqState.data.address
      : scheduledJqState.status === "missing"
        ? scheduledJqState.predictedAddress
        : undefined;
  const isScheduledJqDemo = wallet.status !== "connected" || !wallet.address;
  const schedulerShortfall = scheduledJqStatus
    ? scheduleDraft.requiredBalance > scheduledJqStatus.balance
      ? scheduleDraft.requiredBalance - scheduledJqStatus.balance
      : 0n
    : scheduleDraft.requiredBalance;
  const canCopyEncoded = Boolean(liveAbiDraft?.encodedInput);
  const directCallUnavailableReason =
    selectedRecipe.id === "agent"
      ? "Sovereign Agent calls are launched through the deployed factory harness."
      : selectedRecipe.id === "scheduler" && scheduledJqState.status !== "ready"
        ? "Create your Scheduled JQ consumer before exporting a transaction."
      : undefined;
  const callRequest = React.useMemo(
    () => {
      if (!liveAbiDraft?.encodedInput || directCallUnavailableReason) return undefined;
      if (selectedRecipe.id === "scheduler") {
        const tx = createSchedulerTransaction(
          wallet.address ?? zeroAddress,
          scheduleDraft,
          schedulerShortfall,
          scheduledJqConsumerAddress ?? SCHEDULED_JQ_CONSUMER_ADDRESS,
        );
        return {
          chainId: RITUAL.chainId,
          recipe: selectedRecipe.id,
          label: selectedRecipe.name,
          to: tx.to,
          data: tx.data,
          value: tx.value ?? "0x0",
        };
      }
      return {
        chainId: RITUAL.chainId,
        recipe: selectedRecipe.id,
        label: selectedRecipe.name,
        to: liveAbiDraft.callTarget,
        data: liveAbiDraft.encodedInput,
        value: "0",
      };
    },
    [
      directCallUnavailableReason,
      liveAbiDraft?.callTarget,
      liveAbiDraft?.encodedInput,
      scheduleDraft,
      scheduledJqConsumerAddress,
      schedulerShortfall,
      selectedRecipe.id,
      selectedRecipe.name,
      wallet.address,
    ],
  );
  const castCommand = React.useMemo(
    () =>
      callRequest
        ? `cast send --rpc-url ${RITUAL.rpc} ${callRequest.to} --data ${callRequest.data} --value ${callRequest.value}`
        : undefined,
    [callRequest],
  );
  const cleanHttpExecutorAddress = fieldValue(fieldState.http, "executor").trim();
  const httpExecutorAddressOk = isAddress(cleanHttpExecutorAddress) && cleanHttpExecutorAddress.toLowerCase() !== zeroAddress;
  const cleanSelectedExecutorAddress = hasExecutorField ? fieldValue(selectedFields, "executor").trim() : "";
  const selectedExecutorAddressOk =
    isAddress(cleanSelectedExecutorAddress) && cleanSelectedExecutorAddress.toLowerCase() !== zeroAddress;
  const selectedDiscoveredExecutor = executorDiscovery.executors.find(
    (executor) => executor.address.toLowerCase() === cleanSelectedExecutorAddress.toLowerCase(),
  );
  const agentHarnessStatus = agentHarnessState.status === "ready" ? agentHarnessState.data : undefined;
  const agentLifecycle = agentLifecycleState.status === "ready" ? agentLifecycleState.data : undefined;
  const agentFunding = (() => {
    try {
      return parseEther(agentFundingAmount || "0");
    } catch {
      return 0n;
    }
  })();
  const isScheduledJqOwner =
    Boolean(wallet.address && scheduledJqStatus?.owner) &&
    wallet.address?.toLowerCase() === scheduledJqStatus?.owner.toLowerCase();
  const canCreateScheduledJqConsumer =
    selectedRecipe.id === "scheduler" &&
    scheduledJqState.status === "missing" &&
    wallet.status === "connected" &&
    isRightChain &&
    schedulerTxState.status !== "submitting";
  const hasActiveSchedule = Boolean(
    scheduledJqStatus && scheduledJqStatus.activeScheduleId > 0n && scheduledJqStatus.scheduleState < 2,
  );
  const schedulerLockRemaining =
    scheduledJqStatus && rpcState.block !== undefined
      ? Number(scheduledJqStatus.lockUntil - BigInt(rpcState.block))
      : undefined;
  const schedulerResult = React.useMemo(() => {
    if (!scheduledJqStatus?.lastResult || scheduledJqStatus.lastResult === "0x") return undefined;
    try {
      return decodeJqOutput(scheduledJqStatus.lastResult, scheduleDraft.outputTypeKey);
    } catch {
      return undefined;
    }
  }, [scheduleDraft.outputTypeKey, scheduledJqStatus?.lastResult]);
  const canCreateSchedule =
    selectedRecipe.id === "scheduler" &&
    Boolean(scheduleDraft.encodedInput) &&
    wallet.status === "connected" &&
    isRightChain &&
    isScheduledJqOwner &&
    scheduledJqState.status === "ready" &&
    !hasActiveSchedule &&
    schedulerTxState.status !== "submitting";
  const canCancelSchedule =
    isScheduledJqOwner && hasActiveSchedule && schedulerTxState.status !== "submitting";
  const canWithdrawScheduler = Boolean(
    isScheduledJqOwner &&
      scheduledJqStatus &&
      scheduledJqStatus.balance > 0n &&
      !hasActiveSchedule &&
      rpcState.block !== undefined &&
      scheduledJqStatus.lockUntil <= BigInt(rpcState.block) &&
      schedulerTxState.status !== "submitting",
  );
  const isAgentHarnessOwner =
    Boolean(wallet.address && agentHarnessStatus?.owner) &&
    wallet.address?.toLowerCase() === agentHarnessStatus?.owner.toLowerCase();
  const executorStorageScope = wallet.address?.toLowerCase() ?? "local";
  const activeSavedExecutor = savedExecutors.find(
    (executor) => executor.address.toLowerCase() === cleanSelectedExecutorAddress.toLowerCase(),
  );
  const cleanRunnerAddress = runnerAddress.trim();
  const runnerAddressOk = isAddress(cleanRunnerAddress);
  const runnerStorageScope = wallet.address?.toLowerCase() ?? "local";
  const activeSavedRunner = savedRunners.find(
    (runner) => runner.address.toLowerCase() === cleanRunnerAddress.toLowerCase(),
  );
  const runnerCalldata =
    selectedRecipe.id === "http" && httpDraft.encodedInput
      ? encodeFunctionData({
          abi: httpConsumerAbi,
          functionName: "callHTTPCallRaw",
          args: [httpDraft.encodedInput as `0x${string}`],
        })
      : undefined;
  const llmCalldata =
    selectedRecipe.id === "llm" && llmDraft.encodedInput
      ? encodeFunctionData({
          abi: llmConsumerAbi,
          functionName: "callLlmRaw",
          args: [llmDraft.encodedInput as `0x${string}`],
        })
      : undefined;
  const hasPendingHttpTransaction = runnerRuns.some((run) => run.status === "pending");
  const hasPendingLlmTransaction = llmRun?.status === "pending";
  const hasPendingAgentTransaction = agentRun?.status === "pending";
  const hasPendingAsyncTransaction = hasPendingHttpTransaction || hasPendingLlmTransaction || hasPendingAgentTransaction;
  const llmEvidence = React.useMemo(() => {
    const spcCalls = Array.isArray(llmRun?.receipt?.spcCalls) ? llmRun.receipt.spcCalls.filter(isSpcCall) : [];
    const llmCall = spcCalls.find((call) => call.address?.toLowerCase() === LLM_INFERENCE_PRECOMPILE.toLowerCase());
    return describeLlmPrecompileOutput(llmCall?.output);
  }, [llmRun?.receipt]);
  const canSendLlm =
    Boolean(llmCalldata) &&
    wallet.status === "connected" &&
    isRightChain &&
    isRitualWalletFunded &&
    !hasPendingAsyncTransaction &&
    llmTxState.status !== "submitting";
  const canSendRunner =
    Boolean(runnerCalldata) &&
    runnerAddressOk &&
    runnerCodeState.status === "contract" &&
    wallet.status === "connected" &&
    isRightChain &&
    isRitualWalletFunded &&
    !hasPendingAsyncTransaction &&
    runnerTxState.status !== "submitting";
  const canStartAgent =
    selectedRecipe.id === "agent" &&
    Boolean(agentDraft.encodedInput) &&
    Boolean(selectedDiscoveredExecutor?.publicKey) &&
    wallet.status === "connected" &&
    isRightChain &&
    isAgentHarnessOwner &&
    agentHarnessState.status === "ready" &&
    !agentHarnessStatus?.configured &&
    !agentHarnessStatus?.senderLocked &&
    agentFunding > 0n &&
    !hasPendingAsyncTransaction &&
    agentTxState.status !== "submitting";
  const runnerSetupChecks = React.useMemo(
    () => [
      {
        ok: Boolean(runnerCalldata),
        label: "HTTP input encoded",
        detail: runnerCalldata ? `${Math.floor((runnerCalldata.length - 2) / 2)} calldata bytes` : "Resolve ABI input first.",
      },
      {
        ok: httpExecutorAddressOk,
        label: "TEE executor selected",
        detail: httpExecutorAddressOk ? formatAddress(cleanHttpExecutorAddress) : "Set a registered executor before sending.",
      },
      {
        ok: runnerAddressOk,
        label: "HTTP consumer address set",
        detail: runnerAddressOk ? formatAddress(cleanRunnerAddress) : "Set a verified HTTP consumer address.",
      },
      {
        ok: runnerCodeState.status === "contract",
        label: "Consumer bytecode verified",
        detail: describeRunnerCodeState(runnerCodeState),
      },
      {
        ok: Boolean(activeSavedRunner),
        label: "Consumer saved locally",
        detail: activeSavedRunner?.label ?? "Save the deployed address for reuse.",
      },
      {
        ok: !hasPendingHttpTransaction,
        label: "No HTTP transaction pending",
        detail: hasPendingHttpTransaction
          ? "Wait for the current async transaction to settle before sending another."
          : "This browser has no unsettled HTTP transaction for the current history scope.",
      },
      {
        ok: wallet.status === "connected" && isRightChain,
        label: "Wallet on Ritual",
        detail:
          wallet.status === "connected"
            ? isRightChain
              ? formatAddress(wallet.address)
              : `Current chain ${wallet.chainId ?? "unknown"}`
            : "Connect wallet before sending.",
      },
      {
        ok: wallet.status === "connected" && isRitualWalletFunded,
        label: hasRitualBalance && !isRitualLockSufficient ? "RitualWallet lock expired" : "RitualWallet funded",
        detail:
          wallet.status !== "connected"
            ? "Escrow is checked after wallet connect."
            : hasRitualBalance && !isRitualLockSufficient
              ? `${wallet.ritualWalletBalance ?? "0"} RITUAL escrow, lock ${
                  ritualLockRemaining !== undefined && ritualLockRemaining < 0 ? "expired" : "too short"
                }`
              : `${wallet.ritualWalletBalance ?? "0"} RITUAL escrow`,
      },
    ],
    [
      activeSavedRunner,
      cleanHttpExecutorAddress,
      cleanRunnerAddress,
      httpExecutorAddressOk,
      isRightChain,
      isRitualWalletFunded,
      hasRitualBalance,
      hasPendingHttpTransaction,
      isRitualLockSufficient,
      ritualLockRemaining,
      runnerAddressOk,
      runnerCalldata,
      runnerCodeState,
      wallet.address,
      wallet.chainId,
      wallet.ritualWalletBalance,
      wallet.status,
    ],
  );
  const runnerSetupOpenCount = runnerSetupChecks.filter((check) => !check.ok).length;
  const cleanImportTxHash = importTxHash.trim();
  const importTxHashOk = isTransactionHash(cleanImportTxHash);
  const canImportTx = importTxHashOk && importTxState.status !== "checking";
  const runnerHistoryScopeLabel =
    runnerHistoryScope.endsWith(":local") || !wallet.address ? "local browser" : formatAddress(wallet.address);
  const runnerHistoryCounts = React.useMemo(
    () => ({
      all: runnerRuns.length,
      pending: runnerRuns.filter((run) => run.status === "pending").length,
      confirmed: runnerRuns.filter((run) => run.status === "confirmed").length,
      failed: runnerRuns.filter((run) => run.status === "failed").length,
    }),
    [runnerRuns],
  );
  const visibleRunnerRuns = React.useMemo(
    () => (runnerHistoryFilter === "all" ? runnerRuns : runnerRuns.filter((run) => run.status === runnerHistoryFilter)),
    [runnerHistoryFilter, runnerRuns],
  );
  const pendingRunnerKey = React.useMemo(
    () =>
      runnerRuns
        .filter((run) => run.status === "pending")
        .map((run) => run.hash)
        .join(","),
    [runnerRuns],
  );
  const blockingChecks = React.useMemo(() => {
    const checks = [
      {
        ok: rpcState.status === "online",
        label:
          rpcState.status === "online"
            ? "Ritual RPC responds"
            : rpcState.status === "checking"
              ? "Checking Ritual RPC"
              : "Ritual RPC is offline",
        help:
          rpcState.status === "online"
            ? "Latest block is available."
            : rpcState.status === "checking"
              ? "Waiting for latest block."
              : rpcState.error ?? "Refresh the RPC check.",
      },
      {
        ok: wallet.status === "connected",
        label: wallet.status === "connected" ? "Wallet connected" : "Connect wallet",
        help:
          wallet.status === "connected"
            ? formatAddress(wallet.address)
            : wallet.error ?? "Required before funding or sending.",
      },
      {
        ok: wallet.status === "connected" && isRightChain,
        label: isRightChain ? "Wallet on Ritual chain" : "Switch to chain 1979",
        help:
          wallet.status === "connected"
            ? `Current chain ${wallet.chainId ?? "unknown"}`
            : "Connect first to verify chain.",
      },
      selectedRecipe.id === "scheduler"
        ? {
            ok: scheduledJqState.status === "ready" && isScheduledJqOwner,
            label:
              wallet.status !== "connected"
                ? "Connect for your Scheduler consumer"
                : scheduledJqState.status === "missing"
                  ? "Create Scheduled JQ consumer"
                  : isScheduledJqOwner
                    ? "Scheduled JQ consumer ready"
                    : "Consumer ownership mismatch",
            help:
              wallet.status !== "connected"
                ? "The public demo remains readable; connect to discover your own consumer."
                : scheduledJqState.status === "missing"
                  ? `Factory predicts ${formatAddress(scheduledJqState.predictedAddress)} for this wallet.`
                  : scheduledJqState.status !== "ready"
                    ? "Reading wallet-specific Scheduler escrow."
                : isScheduledJqOwner
                  ? schedulerShortfall > 0n
                    ? `${formatRitual(schedulerShortfall)} RITUAL will be funded atomically.`
                    : "Consumer escrow covers this schedule."
                  : `Owner is ${formatAddress(scheduledJqStatus?.owner)}.`,
          }
        : {
            ok: wallet.status === "connected" && isRitualWalletFunded,
            label: !hasRitualBalance
              ? "Fund RitualWallet"
              : !isRitualLockSufficient
                ? "Extend RitualWallet lock"
                : "RitualWallet funded & locked",
            help:
              wallet.status !== "connected"
                ? "Escrow balance appears after connect."
                : !hasRitualBalance
                  ? wallet.ritualWalletError ?? "Deposit RITUAL escrow before sending async calls."
                  : !isRitualLockSufficient
                    ? `Escrow lock ${
                        ritualLockRemaining !== undefined && ritualLockRemaining < 0 ? "expired" : "too short"
                      } — deposit again with a longer lock (async calls need the escrow locked ~${RITUAL_ASYNC_LOCK_MARGIN}+ blocks ahead).`
                    : `${wallet.ritualWalletBalance ?? "0"} RITUAL, locked ${ritualLockRemaining ?? "?"} blocks ahead`,
          },
      {
        ok: Boolean(liveAbiDraft?.encodedInput) && (liveAbiDraft?.errors.length ?? 1) === 0,
        label:
          selectedRecipe.status !== "preview"
            ? liveAbiDraft?.errors[0] ?? `${selectedRecipe.name} ABI input encodes`
            : `${liveRecipeLabel} are live recipes`,
        help:
          selectedRecipe.status !== "preview"
            ? liveAbiDraft?.encodedInput
              ? `${Math.floor((liveAbiDraft.encodedInput.length - 2) / 2)} encoded bytes`
              : "Fix fields before copying ABI input."
            : "Preview recipes are planning shells for now.",
      },
      {
        ok: sensitiveFieldLabels.length === 0,
        label: sensitiveFieldLabels.length ? "Review secret-looking fields" : "No sharing secrets detected",
        help: sensitiveFieldLabels.length
          ? `${formatNameList(sensitiveFieldLabels.slice(0, 3))}${
              sensitiveFieldLabels.length > 3 ? ` and ${sensitiveFieldLabels.length - 3} more` : ""
            } may contain credentials before copying or sharing.`
          : "Request previews and presets look safe to share.",
      },
    ];

    return selectedRecipe.id === "jq" ? checks.filter((_, index) => ![1, 2, 3].includes(index)) : checks;
  }, [
    isRightChain,
    isRitualWalletFunded,
    hasRitualBalance,
    isRitualLockSufficient,
    isScheduledJqOwner,
    ritualLockRemaining,
    liveAbiDraft,
    liveRecipeLabel,
    rpcState.error,
    rpcState.status,
    sensitiveFieldLabels,
    selectedRecipe.name,
    selectedRecipe.id,
    selectedRecipe.status,
    scheduledJqState.status,
    scheduledJqState.status === "missing" ? scheduledJqState.predictedAddress : undefined,
    scheduledJqStatus?.owner,
    schedulerShortfall,
    wallet.address,
    wallet.chainId,
    wallet.error,
    wallet.ritualWalletBalance,
    wallet.ritualWalletError,
    wallet.status,
  ]);
  const openBlockers = blockingChecks.filter((check) => !check.ok);
  const blockerSummary = openBlockers.length
    ? `${openBlockers.length} ${openBlockers.length === 1 ? "blocker" : "blockers"}`
    : selectedRecipe.id === "jq"
      ? "Ready to run"
      : selectedRecipe.id === "scheduler"
        ? "Ready to schedule"
        : "Ready to copy";
  const contextLabel =
    selectedRecipe.id === "http"
      ? "HTTP precompile"
      : selectedRecipe.id === "llm"
        ? "LLM precompile"
      : selectedRecipe.id === "jq"
        ? "JQ precompile"
        : selectedRecipe.id === "agent"
          ? "Sovereign Agent"
          : selectedRecipe.id === "scheduler"
            ? "Scheduled JQ"
        : `${selectedRecipe.name} recipe`;
  const contextCode =
    selectedRecipe.id === "http"
      ? "0x0801"
      : selectedRecipe.id === "llm"
        ? "0x0802"
        : selectedRecipe.id === "jq"
          ? "0x0803"
          : selectedRecipe.id === "agent"
            ? "0x080C"
          : selectedRecipe.id === "scheduler"
              ? "consumer"
              : "preview";
  const contextDetail =
    selectedRecipe.id === "http"
      ? "13-field ABI"
      : selectedRecipe.id === "llm"
        ? "30-field chat ABI"
        : selectedRecipe.id === "jq"
          ? "3-field sync ABI"
          : selectedRecipe.id === "agent"
            ? "23-field CLI ABI"
            : selectedRecipe.id === "scheduler"
              ? "contract workflow"
              : "planning shell";
  const stageTitle = isPreviewRecipe ? `${selectedRecipe.name} preview` : "Composer";
  const readinessSummary = isPreviewRecipe ? "Preview only" : blockerSummary;
  const readyPillClass = [
    "ready-pill",
    !isPreviewRecipe && !openBlockers.length ? "ok" : "",
    isPreviewRecipe ? "preview" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const encodedActionLabel = copiedEncoded
    ? selectedRecipe.id === "scheduler"
      ? "Copied calldata"
      : "Copied input"
    : liveAbiDraft?.encodedInput
      ? selectedRecipe.id === "scheduler"
        ? "Copy calldata"
        : "Copy ABI input"
      : selectedRecipe.id === "scheduler"
        ? "Resolve calldata"
        : "Resolve ABI input";
  const activeAbiDraft: AbiDraftView | undefined =
    selectedRecipe.id === "http"
      ? {
          label: "HTTP",
          abi: httpDraft.abi,
          encodedInput: httpDraft.encodedInput,
          errors: httpDraft.errors,
          facts: [
            { label: "target", value: httpDraft.callTarget, copyValue: httpDraft.callTarget },
            { label: "method", value: String(httpDraft.methodId), copyValue: String(httpDraft.methodId) },
            {
              label: "ttl",
              value: Number.isFinite(httpDraft.ttl) ? String(httpDraft.ttl) : "invalid",
              copyValue: Number.isFinite(httpDraft.ttl) ? String(httpDraft.ttl) : "invalid",
            },
            {
              label: "bytes",
              value: httpDraft.encodedInput ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes` : "not encoded",
              copyValue: httpDraft.encodedInput
                ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes`
                : "not encoded",
            },
          ],
        }
      : selectedRecipe.id === "llm"
        ? {
            label: "LLM",
            abi: llmDraft.abi,
            encodedInput: llmDraft.encodedInput,
            errors: llmDraft.errors,
            facts: [
              { label: "target", value: llmDraft.callTarget, copyValue: llmDraft.callTarget },
              { label: "model", value: llmDraft.model || "empty", copyValue: llmDraft.model || "" },
              {
                label: "temp",
                value: Number.isFinite(llmDraft.temperature) ? String(llmDraft.temperature) : "invalid",
                copyValue: Number.isFinite(llmDraft.temperature) ? String(llmDraft.temperatureScaled) : "invalid",
              },
              { label: "stream", value: llmDraft.stream ? "true" : "false", copyValue: llmDraft.stream ? "true" : "false" },
              {
                label: "history",
                value: llmDraft.convoHistory[1] || "missing",
                copyValue: llmDraft.convoHistory.join("/"),
              },
              {
                label: "bytes",
                value: llmDraft.encodedInput ? `${Math.floor((llmDraft.encodedInput.length - 2) / 2)} bytes` : "not encoded",
                copyValue: llmDraft.encodedInput
                  ? `${Math.floor((llmDraft.encodedInput.length - 2) / 2)} bytes`
                  : "not encoded",
              },
            ],
          }
      : selectedRecipe.id === "jq"
        ? {
            label: "JQ",
            abi: jqDraft.abi,
            encodedInput: jqDraft.encodedInput,
            errors: jqDraft.errors,
            facts: [
              { label: "target", value: jqDraft.callTarget, copyValue: jqDraft.callTarget },
              { label: "output", value: jqDraft.outputTypeKey, copyValue: String(jqDraft.outputType ?? "invalid") },
              {
                label: "query",
                value: jqDraft.query || "empty",
                copyValue: jqDraft.query || "",
              },
              {
                label: "bytes",
                value: jqDraft.encodedInput ? `${Math.floor((jqDraft.encodedInput.length - 2) / 2)} bytes` : "not encoded",
                copyValue: jqDraft.encodedInput
                  ? `${Math.floor((jqDraft.encodedInput.length - 2) / 2)} bytes`
                  : "not encoded",
              },
            ],
          }
        : selectedRecipe.id === "agent"
          ? {
              label: "Agent",
              abi: agentDraft.abi,
              encodedInput: agentDraft.encodedInput,
              errors: agentDraft.errors,
              facts: [
                { label: "target", value: agentDraft.callTarget, copyValue: agentDraft.callTarget },
                { label: "cli", value: String(agentDraft.cliType), copyValue: String(agentDraft.cliType) },
                {
                  label: "callback",
                  value: isAddress(agentDraft.callbackAddress) ? formatAddress(agentDraft.callbackAddress) : "missing",
                  copyValue: agentDraft.callbackAddress,
                },
                {
                  label: "tools",
                  value: agentDraft.tools.length ? String(agentDraft.tools.length) : "none",
                  copyValue: agentDraft.tools.join(","),
                },
                {
                  label: "bytes",
                  value: agentDraft.encodedInput
                    ? `${Math.floor((agentDraft.encodedInput.length - 2) / 2)} bytes`
                    : "not encoded",
                  copyValue: agentDraft.encodedInput
                    ? `${Math.floor((agentDraft.encodedInput.length - 2) / 2)} bytes`
                    : "not encoded",
                },
              ],
            }
          : selectedRecipe.id === "scheduler"
            ? {
                label: "Scheduler",
                abi: scheduleDraft.abi,
                encodedInput: scheduleDraft.encodedInput,
                errors: scheduleDraft.errors,
                facts: [
                  {
                    label: "target",
                    value: formatAddress(scheduledJqConsumerAddress ?? scheduleDraft.callTarget),
                    copyValue: scheduledJqConsumerAddress ?? scheduleDraft.callTarget,
                  },
                  { label: "output", value: scheduleDraft.outputTypeKey, copyValue: scheduleDraft.outputTypeKey },
                  { label: "calls", value: String(scheduleDraft.numCalls), copyValue: String(scheduleDraft.numCalls) },
                  { label: "freq", value: String(scheduleDraft.frequency), copyValue: String(scheduleDraft.frequency) },
                  {
                    label: "bytes",
                    value: scheduleDraft.encodedInput
                      ? `${Math.floor((scheduleDraft.encodedInput.length - 2) / 2)} bytes`
                      : "not encoded",
                    copyValue: scheduleDraft.encodedInput
                      ? `${Math.floor((scheduleDraft.encodedInput.length - 2) / 2)} bytes`
                      : "not encoded",
                  },
                ],
              }
        : undefined;

  const refreshRpc = React.useCallback(async () => {
    const startedAt = performance.now();
    setRpcState((current) => ({ ...current, status: "checking", error: undefined }));
    try {
      const [chainHex, blockHex] = await Promise.all([
        rpc<string>("eth_chainId"),
        rpc<string>("eth_blockNumber"),
      ]);
      setRpcState({
        status: "online",
        chainId: Number.parseInt(chainHex, 16),
        block: Number.parseInt(blockHex, 16),
        latency: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      setRpcState({
        status: "offline",
        error: error instanceof Error ? error.message : "Unable to reach Ritual RPC",
      });
    }
  }, []);

  const refreshWallet = React.useCallback(async (provider: Eip1193Provider, address?: string) => {
    const accounts = address ? [address] : await provider.request<string[]>({ method: "eth_accounts" });
    const account = accounts[0];
    if (!account) return;
    // Fetch these sequentially (not batched) and treat the balance read as
    // non-fatal: some wallet RPCs 4xx on eth_getBalance/batched calls, and a
    // flaky balance must not abort an otherwise successful connection.
    const chainHex = await provider.request<string>({ method: "eth_chainId" });
    let balanceHex = "0x0";
    try {
      balanceHex = await provider.request<string>({ method: "eth_getBalance", params: [account, "latest"] });
    } catch {
      balanceHex = "0x0";
    }

    let ritualWalletBalance: string | undefined;
    let ritualLockUntil: number | undefined;
    let ritualWalletError: string | undefined;
    try {
      const [escrowHex, lockHex] = await Promise.all([
        rpc<string>("eth_call", [
          {
            to: SYSTEM_CONTRACTS.RitualWallet,
            data: encodeFunctionData({
              abi: ritualWalletAbi,
              functionName: "balanceOf",
              args: [account as `0x${string}`],
            }),
          },
          "latest",
        ]),
        rpc<string>("eth_call", [
          {
            to: SYSTEM_CONTRACTS.RitualWallet,
            data: encodeFunctionData({
              abi: ritualWalletAbi,
              functionName: "lockUntil",
              args: [account as `0x${string}`],
            }),
          },
          "latest",
        ]),
      ]);
      ritualWalletBalance = formatEther(decodeUintHex(escrowHex));
      ritualLockUntil = Number(decodeUintHex(lockHex));
    } catch (error) {
      ritualWalletError = error instanceof Error ? error.message : "Unable to read RitualWallet.";
    }

    setWallet({
      status: "connected",
      address: account,
      chainId: Number.parseInt(chainHex, 16),
      balance: formatBalance(balanceHex),
      ritualWalletBalance,
      ritualLockUntil,
      ritualWalletError,
    });
  }, []);

  const connectWithProvider = React.useCallback(
    async (provider: Eip1193Provider | undefined) => {
      if (!provider) {
        setWallet({ status: "error", error: "No browser wallet found." });
        return;
      }
      setPickedProvider(provider);
      providerRef.current = provider;
      setWallet((current) => ({ ...current, status: "connecting", error: undefined }));
      try {
        const accounts = await requestWalletAccounts(provider);
        await refreshWallet(provider, accounts[0]);
      } catch (error) {
        setWallet({ status: "error", error: walletErrorMessage(error, "Wallet connection failed.") });
      }
    },
    [refreshWallet],
  );

  const connectWallet = React.useCallback(() => {
    // Let the user choose when several wallets are present; otherwise connect
    // straight to the only one available.
    if (injectedWallets.length > 1) {
      setShowWalletPicker(true);
      return;
    }
    connectWithProvider(getProvider());
  }, [connectWithProvider, getProvider, injectedWallets.length]);

  const connectChosenWallet = React.useCallback(
    (detail: EIP6963ProviderDetail) => {
      setShowWalletPicker(false);
      connectWithProvider(detail.provider);
    },
    [connectWithProvider],
  );

  const switchToRitual = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    const currentAddress = wallet.address;
    chainSwitchingRef.current = true;
    chainSwitchAccountRef.current = currentAddress;
    setIsSwitchingChain(true);
    setWallet((current) => ({ ...current, error: undefined }));
    try {
      await ensureRitualChain(provider);
      await refreshWallet(provider, currentAddress);
    } catch (switchError) {
      setWallet((current) => ({
        ...current,
        error: walletErrorMessage(switchError, "Could not switch or add Ritual testnet."),
      }));
    } finally {
      chainSwitchingRef.current = false;
      chainSwitchAccountRef.current = undefined;
      setIsSwitchingChain(false);
    }
  }, [refreshWallet, wallet.address]);

  React.useEffect(() => {
    refreshRpc();
  }, [refreshRpc]);

  React.useEffect(() => {
    setSavedExecutors(parseSavedExecutors(window.localStorage.getItem(executorStorageKey(wallet.address))));
    setSavedRunners(parseSavedRunners(window.localStorage.getItem(runnerStorageKey(wallet.address))));
  }, [wallet.address]);

  React.useEffect(() => {
    if (!runnerAddressOk) {
      setRunnerCodeState({ status: "idle" });
      return;
    }

    let cancelled = false;
    const address = cleanRunnerAddress;
    setRunnerCodeState({ status: "checking", address });

    rpc<string>("eth_getCode", [address, "latest"])
      .then((code) => {
        if (cancelled) return;
        const byteLength = hexByteLength(code);
        setRunnerCodeState(
          code && code !== "0x" && byteLength !== undefined && byteLength > 0
            ? { status: "contract", address, byteLength }
            : { status: "empty", address },
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setRunnerCodeState({
          status: "error",
          address,
          error: error instanceof Error ? error.message : "Could not verify consumer bytecode.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cleanRunnerAddress, runnerAddressOk]);

  React.useEffect(() => {
    const nextScope = runnerHistoryStorageKey(wallet.address);
    runnerHistoryHydrated.current = false;
    setRunnerHistoryScope(nextScope);
    setRunnerRuns(parseRunnerRuns(window.localStorage.getItem(nextScope)));
    runnerHistoryHydrated.current = true;
  }, [wallet.address]);

  React.useEffect(() => {
    if (!runnerHistoryHydrated.current) return;
    window.localStorage.setItem(
      runnerHistoryScope,
      JSON.stringify(runnerRuns.slice(0, RUNNER_HISTORY_LIMIT)),
    );
  }, [runnerHistoryScope, runnerRuns]);

  React.useEffect(() => {
    setRecipePresets(parseRecipePresets(window.localStorage.getItem(PRESET_STORAGE_KEY)));
  }, []);

  React.useEffect(
    () => () => {
      if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
    },
    [],
  );

  React.useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname === "/faq" ? "faq" : "studio");
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  React.useEffect(() => {
    if (selectedPresetId && !visibleRecipePresets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId("");
    }
  }, [selectedPresetId, visibleRecipePresets]);

  React.useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    providerRef.current = provider;
    refreshWallet(provider).catch(() => undefined);

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts?.[0] && chainSwitchingRef.current) return;
      if (!accounts?.[0]) setWallet({ status: "idle" });
      else refreshWallet(provider, accounts[0]).catch(() => undefined);
    };
    const handleChain = () => refreshWallet(provider, chainSwitchAccountRef.current ?? wallet.address).catch(() => undefined);

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [getProvider, refreshWallet, wallet.address]);

  const previewNextStep =
    selectedRecipe.id === "http"
      ? isReady
        ? "Ready for an HTTP consumer call."
        : "Resolve readiness checks before sending."
      : selectedRecipe.id === "jq"
        ? jqDraft.encodedInput
          ? "Run the synchronous JQ call through Ritual RPC. No wallet or gas is required."
          : "Resolve JQ field errors before running the query."
      : selectedRecipe.id === "llm"
        ? llmDraft.encodedInput
          ? `Connect a wallet and send through the verified LLM consumer at ${LLM_PRECOMPILE_CONSUMER_ADDRESS}.`
          : "Resolve LLM field errors before submitting inference."
      : selectedRecipe.id === "scheduler"
        ? scheduleDraft.encodedInput
          ? scheduledJqState.status === "missing"
            ? `Create the consumer predicted for this wallet at ${scheduledJqState.predictedAddress}.`
            : scheduledJqState.status === "ready"
              ? `Schedule through ${scheduledJqState.data.address}. Funding and scheduling use one wallet confirmation.`
              : "Connect a wallet to discover its Scheduled JQ consumer."
          : "Resolve Scheduled JQ field errors before submitting."
      : liveAbiDraft?.encodedInput
        ? `Copy the ${selectedRecipe.name} ABI input and send it to ${liveAbiDraft.callTarget}.`
        : `Resolve ${selectedRecipe.name} field errors before copying ABI input.`;

  const requestPreview = React.useMemo(() => {
    const values = Object.fromEntries(selectedFields.map((field) => [field.key, field.value]));
    return {
      studio: "Precompile Studio",
      chainId: RITUAL.chainId,
      systemContracts: SYSTEM_CONTRACTS,
      recipe: selectedRecipe.id,
      readiness: {
        rpc: rpcState.status,
        wallet: wallet.status,
        rightChain: isRightChain,
        ritualWalletBalance: wallet.ritualWalletBalance ?? "unknown",
        ritualLockUntil: wallet.ritualLockUntil ?? "unknown",
      },
      request: values,
      callRequest,
      castCommand,
      httpDraft: selectedRecipe.id === "http" ? httpDraft : undefined,
      llmDraft: selectedRecipe.id === "llm" ? llmDraft : undefined,
      jqDraft: selectedRecipe.id === "jq" ? jqDraft : undefined,
      agentDraft: selectedRecipe.id === "agent" ? agentDraft : undefined,
      scheduleDraft: selectedRecipe.id === "scheduler" ? scheduleDraft : undefined,
      httpConsumer:
        selectedRecipe.id === "http"
          ? {
              address: cleanRunnerAddress || "unset",
              executor: cleanHttpExecutorAddress || "unset",
              bytecode: {
                status: runnerCodeState.status,
                bytes: runnerCodeState.byteLength ?? null,
              },
              recentTransactions: runnerRuns.map((run) => ({
                hash: run.hash,
                status: run.status,
                blockNumber: decodeHexNumber(run.receipt?.blockNumber) ?? "pending",
                spcCalls: describeSpcCalls(run.receipt),
              })),
            }
          : undefined,
      nextStep: previewNextStep,
    };
  }, [
    cleanHttpExecutorAddress,
    cleanRunnerAddress,
    agentDraft,
    callRequest,
    castCommand,
    httpDraft,
    isRightChain,
    jqDraft,
    llmDraft,
    liveAbiDraft?.callTarget,
    liveAbiDraft?.encodedInput,
    previewNextStep,
    rpcState.status,
    scheduleDraft,
    selectedFields,
    selectedRecipe.id,
    selectedRecipe.name,
    runnerRuns,
    runnerCodeState.byteLength,
    runnerCodeState.status,
    wallet.ritualLockUntil,
    wallet.ritualWalletBalance,
    wallet.status,
  ]);

  const copyText = React.useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback({ tone: "ok", message: successMessage });
      if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
      copyFeedbackTimer.current = window.setTimeout(() => setCopyFeedback(undefined), 1800);
      return true;
    } catch (error) {
      if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
      setCopyFeedback({
        tone: "bad",
        message: error instanceof Error ? `Copy failed: ${error.message}` : "Copy failed. Check browser clipboard permissions.",
      });
      return false;
    }
  }, []);

  const copyPreview = React.useCallback(async () => {
    const copiedToClipboard = await copyText(JSON.stringify(requestPreview, null, 2), "Draft JSON copied.");
    if (!copiedToClipboard) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [copyText, requestPreview]);

  const copyCallRequest = React.useCallback(async () => {
    if (!callRequest) return;
    const copiedToClipboard = await copyText(JSON.stringify(callRequest, null, 2), `${selectedRecipe.name} call JSON copied.`);
    if (!copiedToClipboard) return;
    setCopiedCallRequest(true);
    window.setTimeout(() => setCopiedCallRequest(false), 1400);
  }, [callRequest, copyText, selectedRecipe.name]);

  const copyCastCommand = React.useCallback(async () => {
    if (!castCommand) return;
    const copiedToClipboard = await copyText(castCommand, `${selectedRecipe.name} cast command copied.`);
    if (!copiedToClipboard) return;
    setCopiedCastCommand(true);
    window.setTimeout(() => setCopiedCastCommand(false), 1400);
  }, [castCommand, copyText, selectedRecipe.name]);

  const copyEncodedInput = React.useCallback(async () => {
    if (!liveAbiDraft?.encodedInput) return;
    const copiedToClipboard = await copyText(
      liveAbiDraft.encodedInput,
      selectedRecipe.id === "scheduler" ? "Scheduler calldata copied." : `${selectedRecipe.name} ABI input copied.`,
    );
    if (!copiedToClipboard) return;
    setCopiedEncoded(true);
    window.setTimeout(() => setCopiedEncoded(false), 1400);
  }, [copyText, liveAbiDraft, selectedRecipe.id, selectedRecipe.name]);

  const executeJq = React.useCallback(async () => {
    if (!jqDraft.encodedInput) return;
    setJqCallState({ status: "running" });
    try {
      const outcome = await runJqCall(jqDraft.encodedInput, jqDraft.outputTypeKey);
      setJqCallState(outcome);
    } catch (error) {
      setJqCallState({
        status: "error",
        error: error instanceof Error ? error.message : "JQ call failed.",
      });
    }
  }, [jqDraft.encodedInput, jqDraft.outputTypeKey]);

  React.useEffect(() => {
    setJqCallState({ status: "idle" });
  }, [jqDraft.encodedInput, jqDraft.outputTypeKey]);

  const copyRunnerCalldata = React.useCallback(async () => {
    if (!runnerCalldata) return;
    const copiedToClipboard = await copyText(runnerCalldata, "HTTP consumer calldata copied.");
    if (!copiedToClipboard) return;
    setCopiedRunnerCalldata(true);
    window.setTimeout(() => setCopiedRunnerCalldata(false), 1400);
  }, [copyText, runnerCalldata]);

  const refreshRunnerReceipt = React.useCallback(async (hash: string) => {
    try {
      const receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
      setRunnerRuns((current) =>
        current.map((run) =>
          run.hash === hash
            ? {
                ...run,
                status: receiptStatus(receipt ?? undefined),
                receipt: receipt ?? undefined,
                error: undefined,
              }
            : run,
        ),
      );
    } catch (error) {
      setRunnerRuns((current) =>
        current.map((run) =>
          run.hash === hash
            ? {
                ...run,
                error: error instanceof Error ? error.message : "Receipt lookup failed.",
              }
            : run,
        ),
      );
    }
  }, []);

  const refreshLlmReceipt = React.useCallback(async (hash: string) => {
    try {
      const receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
      setLlmRun((current) =>
        current?.hash === hash
          ? {
              ...current,
              status: receiptStatus(receipt ?? undefined),
              receipt: receipt ?? undefined,
              error: undefined,
            }
          : current,
      );
    } catch (error) {
      setLlmRun((current) =>
        current?.hash === hash
          ? { ...current, error: error instanceof Error ? error.message : "LLM receipt lookup failed." }
          : current,
      );
    }
  }, []);

  const importRunnerTransaction = React.useCallback(async () => {
    const hash = cleanImportTxHash;
    if (!isTransactionHash(hash)) {
      setImportTxState({ status: "error", error: "Paste a 66-character transaction hash." });
      return;
    }

    setImportTxState({ status: "checking" });
    try {
      const receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
      const nextRun: RunnerRun = {
        hash,
        runnerAddress: runnerAddressOk ? cleanRunnerAddress : zeroAddress,
        submittedAt: Date.now(),
        method: "external",
        url: "Imported transaction hash",
        source: "imported",
        status: receiptStatus(receipt ?? undefined),
        receipt: receipt ?? undefined,
      };
      setRunnerRuns((current) =>
        [nextRun, ...current.filter((run) => run.hash.toLowerCase() !== hash.toLowerCase())].slice(
          0,
          RUNNER_HISTORY_LIMIT,
        ),
      );
      setImportTxHash("");
      setImportTxState({
        status: "imported",
        error: receipt ? undefined : "Transaction imported. Receipt is not available yet.",
      });
    } catch (error) {
      setImportTxState({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to import transaction.",
      });
    }
  }, [cleanImportTxHash, cleanRunnerAddress, runnerAddressOk]);

  const copyValue = React.useCallback(
    async (value: string) => {
      await copyText(value, "Value copied.");
    },
    [copyText],
  );

  const clearRunnerHistory = React.useCallback(() => {
    setRunnerRuns([]);
    window.localStorage.removeItem(runnerHistoryScope);
    setRunnerHistoryMessage("HTTP history cleared.");
  }, [runnerHistoryScope]);

  const copyRunnerHistoryJson = React.useCallback(async () => {
    if (!runnerRuns.length) return;
    const copiedToClipboard = await copyText(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          scope: runnerHistoryScopeLabel,
          runs: runnerRuns,
        },
        null,
        2,
      ),
      "HTTP history JSON copied.",
    );
    if (!copiedToClipboard) {
      setRunnerHistoryMessage("Copy failed. Check browser clipboard permissions.");
      return;
    }
    setCopiedRunnerHistory(true);
    setRunnerHistoryMessage("HTTP history JSON copied.");
    window.setTimeout(() => setCopiedRunnerHistory(false), 1400);
  }, [copyText, runnerHistoryScopeLabel, runnerRuns]);

  const importRunnerHistoryJson = React.useCallback(() => {
    const imported = parseRunnerHistoryImport(runnerHistoryImportValue);
    if (!imported.length) {
      setRunnerHistoryMessage("Paste valid Precompile Studio HTTP history JSON.");
      return;
    }

    setRunnerRuns((current) => {
      const importedHashes = new Set(imported.map((run) => run.hash.toLowerCase()));
      return [...imported, ...current.filter((run) => !importedHashes.has(run.hash.toLowerCase()))].slice(
        0,
        RUNNER_HISTORY_LIMIT,
      );
    });
    setRunnerHistoryImportValue("");
    setRunnerHistoryMessage(`${imported.length} ${imported.length === 1 ? "transaction" : "transactions"} imported.`);
  }, [runnerHistoryImportValue]);

  const saveRecipePreset = React.useCallback(() => {
    const label = presetLabel.trim();
    if (!label) return;

    const nextPreset: RecipePreset = {
      id: `${selectedRecipe.id}-${Date.now()}`,
      recipeId: selectedRecipe.id,
      label,
      fields: selectedFields.map((field) => ({ ...field })),
      updatedAt: Date.now(),
      source: "local",
    };
    setRecipePresets((current) => {
      const next = [nextPreset, ...current].slice(0, 24);
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setPresetLabel("");
    setSelectedPresetId(nextPreset.id);
  }, [presetLabel, selectedFields, selectedRecipe.id]);

  const applyRecipePreset = React.useCallback(() => {
    if (!selectedPreset) return;
    setFieldState((current) => ({
      ...current,
      [selectedPreset.recipeId]: normalizePresetFields(selectedPreset.recipeId, selectedPreset.fields),
    }));
  }, [selectedPreset]);

  const forgetRecipePreset = React.useCallback(() => {
    if (!selectedPreset || selectedPreset.source === "example") return;
    setRecipePresets((current) => {
      const next = current.filter((preset) => preset.id !== selectedPreset.id);
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSelectedPresetId("");
  }, [selectedPreset]);

  const copySelectedPresetJson = React.useCallback(async () => {
    if (!selectedPreset) return;
    const copiedToClipboard = await copyText(
      JSON.stringify(
        {
          version: 1,
          preset: selectedPreset,
        },
        null,
        2,
      ),
      "Preset JSON copied.",
    );
    if (!copiedToClipboard) {
      setPresetTransferMessage("Copy failed. Check browser clipboard permissions.");
      return;
    }
    setCopiedPresetJson(true);
    setPresetTransferMessage("Preset JSON copied.");
    window.setTimeout(() => setCopiedPresetJson(false), 1400);
  }, [copyText, selectedPreset]);

  const importRecipePresetJson = React.useCallback(() => {
    const imported = parseRecipePresetImport(presetImportValue);
    if (!imported.length) {
      setPresetTransferMessage("Paste a valid Precompile Studio preset JSON.");
      return;
    }

    const now = Date.now();
    const normalized = imported.map((preset, index) => ({
      ...preset,
      id: `${preset.recipeId}-${now}-${index}`,
      updatedAt: now,
    }));
    setRecipePresets((current) => {
      const next = [...normalized, ...current].slice(0, 24);
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSelectedPresetId(normalized[0]?.recipeId === selectedRecipe.id ? normalized[0].id : "");
    setPresetImportValue("");
    setPresetTransferMessage(`${normalized.length} ${normalized.length === 1 ? "preset" : "presets"} imported.`);
  }, [presetImportValue, selectedRecipe.id]);

  const saveExecutor = React.useCallback(() => {
    if (!selectedExecutorAddressOk) return;
    const normalizedAddress = cleanSelectedExecutorAddress;
    const nextExecutor: SavedExecutor = {
      address: normalizedAddress,
      label: executorLabel.trim() || activeSavedExecutor?.label || defaultExecutorLabel(normalizedAddress),
      updatedAt: Date.now(),
    };
    setSavedExecutors((current) => {
      const next = [
        nextExecutor,
        ...current.filter((executor) => executor.address.toLowerCase() !== normalizedAddress.toLowerCase()),
      ].slice(0, 8);
      window.localStorage.setItem(executorStorageKey(wallet.address), JSON.stringify(next));
      return next;
    });
    setExecutorLabel("");
  }, [activeSavedExecutor?.label, cleanSelectedExecutorAddress, executorLabel, selectedExecutorAddressOk, wallet.address]);

  const useSavedExecutor = React.useCallback(
    (address: string) => {
      setFieldState((current) => ({
        ...current,
        [selectedRecipe.id]: current[selectedRecipe.id].map((field) =>
          field.key === "executor" ? { ...field, value: address } : field,
        ),
      }));
      setExecutorLabel("");
    },
    [selectedRecipe.id],
  );

  const refreshExecutorDiscovery = React.useCallback(
    async (capabilityId = executorDiscovery.capabilityId) => {
      setExecutorDiscovery((current) => ({
        ...current,
        capabilityId,
        status: "loading",
        error: undefined,
      }));
      try {
        const result = await discoverExecutors(capabilityId);
        setExecutorDiscovery({
          status: "ready",
          capabilityId,
          executors: result.executors,
          total: result.total,
        });
      } catch (error) {
        setExecutorDiscovery((current) => ({
          ...current,
          capabilityId,
          status: "error",
          executors: [],
          total: undefined,
          error: error instanceof Error ? error.message : "Could not read TEEServiceRegistry.",
        }));
      }
    },
    [executorDiscovery.capabilityId],
  );

  const selectExecutorCapability = React.useCallback(
    (capabilityId: number) => {
      refreshExecutorDiscovery(capabilityId).catch(() => undefined);
    },
    [refreshExecutorDiscovery],
  );

  const useDiscoveredExecutor = React.useCallback(
    (executor: DiscoveredExecutor) => {
      setFieldState((current) => ({
        ...current,
        [selectedRecipe.id]: current[selectedRecipe.id].map((field) =>
          field.key === "executor" ? { ...field, value: executor.address } : field,
        ),
      }));
      setExecutorLabel(`${capabilityLabel(executor.capabilityId)} ${formatAddress(executor.address)}`);
    },
    [selectedRecipe.id],
  );

  React.useEffect(() => {
    if (!hasExecutorField) return;
    const capabilityId = defaultCapabilityForRecipe(selectedRecipe.id);
    refreshExecutorDiscovery(capabilityId).catch(() => undefined);
  }, [hasExecutorField, selectedRecipe.id]);

  const forgetSavedExecutor = React.useCallback(
    (address: string) => {
      setSavedExecutors((current) => {
        const next = current.filter((executor) => executor.address.toLowerCase() !== address.toLowerCase());
        window.localStorage.setItem(executorStorageKey(wallet.address), JSON.stringify(next));
        return next;
      });
    },
    [wallet.address],
  );

  const saveRunnerContract = React.useCallback(() => {
    if (!runnerAddressOk) return;
    const normalizedAddress = cleanRunnerAddress;
    const nextRunner: SavedRunner = {
      address: normalizedAddress,
      label: runnerLabel.trim() || activeSavedRunner?.label || defaultRunnerLabel(normalizedAddress),
      updatedAt: Date.now(),
    };
    setSavedRunners((current) => {
      const next = [nextRunner, ...current.filter((runner) => runner.address.toLowerCase() !== normalizedAddress.toLowerCase())].slice(
        0,
        8,
      );
      window.localStorage.setItem(runnerStorageKey(wallet.address), JSON.stringify(next));
      return next;
    });
    setRunnerLabel("");
  }, [activeSavedRunner?.label, cleanRunnerAddress, runnerAddressOk, runnerLabel, wallet.address]);

  const useSavedRunner = React.useCallback((address: string) => {
    setRunnerAddress(address);
    setRunnerLabel("");
  }, []);

  const forgetSavedRunner = React.useCallback(
    (address: string) => {
      setSavedRunners((current) => {
        const next = current.filter((runner) => runner.address.toLowerCase() !== address.toLowerCase());
        window.localStorage.setItem(runnerStorageKey(wallet.address), JSON.stringify(next));
        return next;
      });
    },
    [wallet.address],
  );

  const depositToRitualWallet = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address) {
      setDepositState({ status: "error", error: "Connect a wallet before funding RitualWallet." });
      return;
    }

    let value: bigint;
    try {
      value = parseEther(depositAmount);
    } catch {
      setDepositState({ status: "error", error: "Enter a valid RITUAL amount." });
      return;
    }

    if (value <= 0n || !Number.isFinite(depositLock) || depositLock <= 0) {
      setDepositState({ status: "error", error: "Amount and lock duration must be positive." });
      return;
    }

    const lockDuration = BigInt(depositLock);

    setDepositState({ status: "submitting" });
    try {
      const tx = await prepareWalletTransaction(
        createRitualDepositTransaction(wallet.address, value, lockDuration),
        "0x249f0",
      );
      const hash = await sendWalletTransaction(provider, tx);
      setDepositState({ status: "submitted", hash });
      window.setTimeout(() => {
        refreshWallet(provider, wallet.address).catch(() => undefined);
      }, 2500);
    } catch (error) {
      setDepositState({
        status: "error",
        error: error instanceof Error ? error.message : "RitualWallet deposit was rejected.",
      });
    }
  }, [depositAmount, depositLock, refreshWallet, wallet.address]);

  const refreshScheduledJq = React.useCallback(async () => {
    setScheduledJqState((current) => {
      const currentMatchesWallet = current.status === "ready" && (wallet.address
        ? current.data.address.toLowerCase() !== SCHEDULED_JQ_CONSUMER_ADDRESS.toLowerCase()
          && current.data.owner.toLowerCase() === wallet.address.toLowerCase()
        : current.data.address.toLowerCase() === SCHEDULED_JQ_CONSUMER_ADDRESS.toLowerCase());
      return currentMatchesWallet ? current : { status: "loading" };
    });
    try {
      let consumerAddress = SCHEDULED_JQ_CONSUMER_ADDRESS;
      let deploymentBlock = SCHEDULED_JQ_DEPLOYMENT_BLOCK;
      if (wallet.address) {
        const discovery = await readScheduledJqConsumerDiscovery(wallet.address);
        if (discovery.status === "missing") {
          setScheduledJqState(discovery);
          return discovery;
        }
        consumerAddress = discovery.address;
        deploymentBlock = SCHEDULED_JQ_FACTORY_DEPLOYMENT_BLOCK;
      }
      const originTransactionHash = window.localStorage.getItem(
        schedulerOriginTransactionStorageKey(consumerAddress),
      ) ?? undefined;
      const data = await readScheduledJqConsumerStatus(
        rpc,
        originTransactionHash,
        consumerAddress,
        deploymentBlock,
      );
      setScheduledJqState({ status: "ready", data });
      return data;
    } catch (error) {
      setScheduledJqState({
        status: "error",
        error: error instanceof Error ? error.message : "Could not read the Scheduled JQ consumer.",
      });
      return undefined;
    }
  }, [wallet.address]);

  const createScheduledJqConsumer = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address) {
      setSchedulerTxState({ status: "error", action: "deploy", error: "Connect a wallet before creating a consumer." });
      return;
    }
    if (!isRightChain) {
      setSchedulerTxState({ status: "error", action: "deploy", error: "Switch the wallet to Ritual before creating a consumer." });
      return;
    }
    setSchedulerTxState({ status: "submitting", action: "deploy" });
    try {
      const tx = await prepareWalletTransaction(createScheduledJqConsumerTransaction(wallet.address), "0x3d0900");
      const hash = await sendWalletTransaction(provider, tx);
      setSchedulerTxState({ status: "submitted", action: "deploy", hash });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const discovery = await readScheduledJqConsumerDiscovery(wallet.address);
        if (discovery.status === "ready") {
          await refreshScheduledJq();
          return;
        }
      }
      setSchedulerTxState({
        status: "error",
        action: "deploy",
        hash,
        error: "Consumer creation is still confirming. Use Refresh after the transaction is included.",
      });
    } catch (error) {
      setSchedulerTxState({
        status: "error",
        action: "deploy",
        error: error instanceof Error ? error.message : "Consumer creation was rejected.",
      });
    }
  }, [isRightChain, refreshScheduledJq, wallet.address]);

  const submitScheduledJq = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address) {
      setSchedulerTxState({ status: "error", action: "schedule", error: "Connect a wallet before scheduling." });
      return;
    }
    if (!isScheduledJqOwner) {
      setSchedulerTxState({ status: "error", action: "schedule", error: "The connected wallet is not the consumer owner." });
      return;
    }
    if (!scheduledJqConsumerAddress) {
      setSchedulerTxState({ status: "error", action: "schedule", error: "Create your Scheduled JQ consumer first." });
      return;
    }
    setSchedulerTxState({ status: "submitting", action: "schedule" });
    try {
      const tx = await prepareWalletTransaction(
        createSchedulerTransaction(wallet.address, scheduleDraft, schedulerShortfall, scheduledJqConsumerAddress),
        "0xf4240",
      );
      const hash = await sendWalletTransaction(provider, tx);
      window.localStorage.setItem(schedulerOriginTransactionStorageKey(scheduledJqConsumerAddress), hash);
      setSchedulerTxState({ status: "submitted", action: "schedule", hash });
      window.setTimeout(() => refreshScheduledJq().catch(() => undefined), 2500);
    } catch (error) {
      setSchedulerTxState({
        status: "error",
        action: "schedule",
        error: error instanceof Error ? error.message : "Scheduled JQ submission was rejected.",
      });
    }
  }, [isScheduledJqOwner, refreshScheduledJq, scheduleDraft, scheduledJqConsumerAddress, schedulerShortfall, wallet.address]);

  const cancelScheduledJq = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address || !scheduledJqConsumerAddress || !canCancelSchedule) return;
    setSchedulerTxState({ status: "submitting", action: "cancel" });
    try {
      const tx = await prepareWalletTransaction(
        createSchedulerControlTransaction(wallet.address, "cancelSchedule", undefined, scheduledJqConsumerAddress),
        "0x493e0",
      );
      const hash = await sendWalletTransaction(provider, tx);
      setSchedulerTxState({ status: "submitted", action: "cancel", hash });
      window.setTimeout(() => refreshScheduledJq().catch(() => undefined), 2500);
    } catch (error) {
      setSchedulerTxState({
        status: "error",
        action: "cancel",
        error: error instanceof Error ? error.message : "Schedule cancellation was rejected.",
      });
    }
  }, [canCancelSchedule, refreshScheduledJq, scheduledJqConsumerAddress, wallet.address]);

  const withdrawScheduledJq = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address || !scheduledJqStatus || !scheduledJqConsumerAddress || !canWithdrawScheduler) return;
    setSchedulerTxState({ status: "submitting", action: "withdraw" });
    try {
      const tx = await prepareWalletTransaction(
        createSchedulerControlTransaction(wallet.address, "withdraw", scheduledJqStatus.balance, scheduledJqConsumerAddress),
        "0x493e0",
      );
      const hash = await sendWalletTransaction(provider, tx);
      setSchedulerTxState({ status: "submitted", action: "withdraw", hash });
      window.setTimeout(() => refreshScheduledJq().catch(() => undefined), 2500);
    } catch (error) {
      setSchedulerTxState({
        status: "error",
        action: "withdraw",
        error: error instanceof Error ? error.message : "Consumer withdrawal was rejected.",
      });
    }
  }, [canWithdrawScheduler, refreshScheduledJq, scheduledJqConsumerAddress, scheduledJqStatus, wallet.address]);

  const refreshAgentHarness = React.useCallback(async () => {
    setAgentHarnessState({ status: "loading" });
    try {
      const data = await readAgentHarnessStatus();
      setAgentHarnessState({ status: "ready", data });
      return data;
    } catch (error) {
      setAgentHarnessState({
        status: "error",
        error: error instanceof Error ? error.message : "Could not read the Sovereign Agent harness.",
      });
      return undefined;
    }
  }, []);

  const refreshAgentLifecycle = React.useCallback(async (configured = agentHarnessStatus?.configured ?? false) => {
    setAgentLifecycleState({ status: "loading" });
    try {
      setAgentLifecycleState({ status: "ready", data: await readAgentLifecycle(configured) });
    } catch (error) {
      setAgentLifecycleState({
        status: "error",
        error: error instanceof Error ? error.message : "Could not read the Agent lifecycle events.",
      });
    }
  }, [agentHarnessStatus?.configured]);

  const refreshAgentReceipt = React.useCallback(async (hash: string) => {
    try {
      const receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
      if (!receipt) return;
      setAgentRun((current) =>
        current?.hash.toLowerCase() === hash.toLowerCase()
          ? { ...current, status: receiptStatus(receipt), receipt, error: undefined }
          : current,
      );
      const status = await refreshAgentHarness();
      await refreshAgentLifecycle(status?.configured ?? false);
    } catch (error) {
      setAgentRun((current) =>
        current?.hash.toLowerCase() === hash.toLowerCase()
          ? { ...current, error: error instanceof Error ? error.message : "Agent receipt lookup failed." }
          : current,
      );
    }
  }, [refreshAgentHarness, refreshAgentLifecycle]);

  const startAgent = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address) {
      setAgentTxState({ status: "error", error: "Connect the harness owner wallet before starting the Agent." });
      return;
    }
    if (!selectedDiscoveredExecutor?.publicKey) {
      setAgentTxState({ status: "error", error: "Select an executor from live registry discovery so its encryption key is available." });
      return;
    }
    if (!isAgentHarnessOwner) {
      setAgentTxState({ status: "error", error: "The connected wallet is not the owner of this Agent harness." });
      return;
    }
    if (agentHarnessStatus?.configured) {
      setAgentTxState({ status: "error", error: "This harness is already configured. Its active series cannot be configured twice." });
      return;
    }
    if (agentFunding <= 0n) {
      setAgentTxState({ status: "error", error: "Enter a positive scheduler funding amount." });
      return;
    }
    if (hasPendingAsyncTransaction) {
      setAgentTxState({ status: "error", error: "An async transaction is already pending. Wait for it to settle before starting the Agent." });
      return;
    }

    setAgentTxState({ status: "submitting" });
    try {
      const encryptedSecrets = await encryptAgentProviderSecret(selectedDiscoveredExecutor.publicKey);
      const nextFields = fieldState.agent.map((field) =>
        field.key === "encryptedSecrets" ? { ...field, value: encryptedSecrets } : field,
      );
      const nextDraft = buildAgentDraft(nextFields);
      if (!nextDraft.encodedInput || nextDraft.errors.length) {
        throw new Error(nextDraft.errors[0] ?? "Resolve the Sovereign Agent input before starting the harness.");
      }
      setFieldState((current) => ({ ...current, agent: nextFields }));
      const tx = await prepareWalletTransaction(
        createAgentHarnessTransaction(wallet.address, nextDraft, agentFunding),
        "0x4c4b40",
      );
      const hash = await sendWalletTransaction(provider, tx);
      setAgentTxState({ status: "submitted", hash });
      setAgentRun({ hash, submittedAt: Date.now(), status: "pending" });
      window.setTimeout(() => refreshAgentReceipt(hash).catch(() => undefined), 2500);
    } catch (error) {
      setAgentTxState({
        status: "error",
        error: error instanceof Error ? error.message : "Sovereign Agent launch was rejected.",
      });
    }
  }, [
    agentFunding,
    agentHarnessStatus?.configured,
    fieldState.agent,
    hasPendingAsyncTransaction,
    isAgentHarnessOwner,
    refreshAgentReceipt,
    selectedDiscoveredExecutor?.publicKey,
    wallet.address,
  ]);

  const sendLlmTransaction = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address || !llmCalldata) {
      setLlmTxState({ status: "error", error: "Connect a wallet and resolve the LLM input before sending." });
      return;
    }
    if (hasPendingAsyncTransaction) {
      setLlmTxState({ status: "error", error: "This wallet already has an async transaction pending." });
      return;
    }

    setLlmTxState({ status: "submitting" });
    try {
      const tx = await prepareWalletTransaction(
        createLlmConsumerTransaction(wallet.address, llmDraft.encodedInput as `0x${string}`),
        "0x2dc6c0",
      );
      const hash = await sendWalletTransaction(provider, tx);
      setLlmTxState({ status: "submitted", hash });
      setLlmRun({ hash, submittedAt: Date.now(), status: "pending" });
      window.setTimeout(() => refreshLlmReceipt(hash).catch(() => undefined), 2500);
    } catch (error) {
      setLlmTxState({
        status: "error",
        error: error instanceof Error ? error.message : "LLM consumer transaction was rejected.",
      });
    }
  }, [hasPendingAsyncTransaction, llmCalldata, llmDraft.encodedInput, refreshLlmReceipt, wallet.address]);

  const sendRunnerTransaction = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || !wallet.address || !runnerCalldata || !runnerAddressOk) {
      setRunnerTxState({ status: "error", error: "Connect wallet, encode HTTP input, and set a consumer address." });
      return;
    }
    if (hasPendingAsyncTransaction) {
      setRunnerTxState({
        status: "error",
        error: "This wallet already has an async transaction pending. Wait for it to settle before sending HTTP.",
      });
      return;
    }

    setRunnerTxState({ status: "submitting" });
    try {
      const tx = await prepareWalletTransaction({
        from: wallet.address,
        to: cleanRunnerAddress,
        data: runnerCalldata,
      }, "0x1e8480");
      const hash = await sendWalletTransaction(provider, tx);
      setRunnerTxState({ status: "submitted", hash });
      const nextRun: RunnerRun = {
        hash,
        runnerAddress: cleanRunnerAddress,
        submittedAt: Date.now(),
        method: fieldValue(fieldState.http, "method"),
        url: fieldValue(fieldState.http, "url"),
        status: "pending",
      };
      setRunnerRuns((current) =>
        [nextRun, ...current.filter((run) => run.hash.toLowerCase() !== hash.toLowerCase())].slice(
          0,
          RUNNER_HISTORY_LIMIT,
        ),
      );
      window.setTimeout(() => {
        refreshRunnerReceipt(hash).catch(() => undefined);
      }, 2500);
    } catch (error) {
      setRunnerTxState({
        status: "error",
        error: error instanceof Error ? error.message : "HTTP consumer transaction was rejected.",
      });
    }
  }, [cleanRunnerAddress, fieldState.http, hasPendingAsyncTransaction, refreshRunnerReceipt, runnerAddressOk, runnerCalldata, wallet.address]);

  React.useEffect(() => {
    const pendingHashes = pendingRunnerKey ? pendingRunnerKey.split(",") : [];
    if (!pendingHashes.length) return undefined;

    let cancelled = false;
    const poll = async () => {
      const receipts = await Promise.all(
        pendingHashes.map(async (hash) => {
          try {
            return { hash, receipt: await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]) };
          } catch (error) {
            return { hash, error: error instanceof Error ? error.message : "Receipt lookup failed." };
          }
        }),
      );

      if (cancelled) return;
      if (!receipts.some((result) => "error" in result || result.receipt)) return;
      setRunnerRuns((current) =>
        current.map((run) => {
          const result = receipts.find((item) => item.hash === run.hash);
          if (!result) return run;
          if ("error" in result) return { ...run, error: result.error };
          if (!result.receipt) return run;
          return {
            ...run,
            status: receiptStatus(result.receipt),
            receipt: result.receipt,
            error: undefined,
          };
        }),
      );
    };

    const timer = window.setInterval(() => {
      poll().catch(() => undefined);
    }, 6000);
    poll().catch(() => undefined);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingRunnerKey]);

  React.useEffect(() => {
    if (!llmRun || llmRun.status !== "pending") return undefined;
    const timer = window.setInterval(() => {
      refreshLlmReceipt(llmRun.hash).catch(() => undefined);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [llmRun, refreshLlmReceipt]);

  React.useEffect(() => {
    if (selectedRecipe.id !== "scheduler") return undefined;
    refreshScheduledJq().catch(() => undefined);
    if (!hasActiveSchedule) return undefined;
    const timer = window.setInterval(() => refreshScheduledJq().catch(() => undefined), 8_000);
    return () => window.clearInterval(timer);
  }, [hasActiveSchedule, refreshScheduledJq, selectedRecipe.id, wallet.address]);

  React.useEffect(() => {
    if (selectedRecipe.id !== "agent") return undefined;
    const refresh = async () => {
      const status = await refreshAgentHarness();
      await refreshAgentLifecycle(status?.configured ?? false);
    };
    refresh().catch(() => undefined);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshAgentHarness, refreshAgentLifecycle, selectedRecipe.id, wallet.address]);

  React.useEffect(() => {
    if (!agentRun || agentRun.status !== "pending") return undefined;
    const timer = window.setInterval(() => {
      refreshAgentReceipt(agentRun.hash).catch(() => undefined);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [agentRun, refreshAgentReceipt]);

  const updateField = (key: string, value: string) => {
    setFieldState((current) => ({
      ...current,
      [selectedRecipe.id]: current[selectedRecipe.id].map((field) =>
        field.key === key ? { ...field, value } : field,
      ),
    }));
  };

  const selectRecipe = React.useCallback((recipeId: RecipeId, shouldFocus = false) => {
    setActiveRecipe(recipeId);
    if (shouldFocus) {
      window.requestAnimationFrame(() => document.getElementById(`recipe-tab-${recipeId}`)?.focus());
    }
  }, []);

  const navigate = React.useCallback((path: "/" | "/faq") => {
    window.history.pushState(null, "", path);
    setRoute(path === "/faq" ? "faq" : "studio");
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="studio-shell">
      <header className="explorer-header">
        <div className="header-inner">
          <a
            className="brand-lockup"
            href="/"
            aria-label="Precompile Studio home"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <span className="brand-mark">
              <Blocks size={22} />
            </span>
          </a>
          <nav className="header-nav" aria-label="Ritual links">
            <a
              href="/faq"
              aria-current={route === "faq" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate("/faq");
              }}
            >
              FAQ
            </a>
            <a href={RITUAL.docs} target="_blank" rel="noreferrer">
              Docs
            </a>
            <a href={RITUAL.faucet} target="_blank" rel="noreferrer">
              Faucet
            </a>
            <a href={RITUAL.explorer} target="_blank" rel="noreferrer">
              Explorer
            </a>
          </nav>
          <div className="topbar-actions">
            <button className="primary-action" onClick={connectWallet} disabled={wallet.status === "connecting"}>
              {wallet.status === "connecting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
              {wallet.status === "connected" ? formatAddress(wallet.address) : "Connect"}
            </button>
          </div>
        </div>
      </header>

      {showWalletPicker ? (
        <div
          className="wallet-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a wallet"
          onClick={() => setShowWalletPicker(false)}
        >
          <div className="wallet-picker" onClick={(event) => event.stopPropagation()}>
            <div className="wallet-picker-head">
              <span>Choose a wallet</span>
              <button
                type="button"
                className="wallet-picker-close"
                aria-label="Close"
                onClick={() => setShowWalletPicker(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="wallet-picker-list">
              {injectedWallets.map((detail) => (
                <button
                  key={detail.info.rdns}
                  type="button"
                  className="wallet-option"
                  onClick={() => connectChosenWallet(detail)}
                >
                  {detail.info.icon ? (
                    <img src={detail.info.icon} alt="" width={24} height={24} />
                  ) : (
                    <Wallet size={20} />
                  )}
                  <span>{detail.info.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {route === "faq" ? (
        <FaqPage onStart={() => navigate("/")} />
      ) : (
      <section className="workspace">
        <section className="workbench-head">
          <div>
            <h1>Precompile Studio</h1>
          </div>
          <div className="context-strip" aria-label="Current workbench context">
            <Code2 size={17} />
            <span>{contextLabel}</span>
            <code>{contextCode}</code>
            <span>{contextDetail}</span>
          </div>
        </section>

        <section className="status-strip" aria-label="Readiness checks">
          <StatusItem
            icon={RadioTower}
            label="RPC"
            value={
              rpcState.status === "online"
                ? `online · ${rpcState.latency}ms`
                : rpcState.status === "checking"
                  ? "checking"
                  : "offline"
            }
            tone={rpcState.status === "online" ? "ok" : rpcState.status === "offline" ? "bad" : "wait"}
            action={<button onClick={refreshRpc} aria-label="Refresh RPC"><RefreshCw size={15} /></button>}
          />
          <StatusItem
            icon={Blocks}
            label="Block"
            value={rpcState.block ? rpcState.block.toLocaleString() : "pending"}
            tone={rpcState.status === "online" ? "ok" : "wait"}
          />
          <StatusItem
            icon={Link2}
            label="Chain"
            value={wallet.status === "connected" ? String(wallet.chainId ?? "unknown") : "wallet needed"}
            tone={wallet.status !== "connected" ? "wait" : isRightChain ? "ok" : "bad"}
            action={
              wallet.status === "connected" && !isRightChain ? (
                <button
                  className="chain-switch-action"
                  type="button"
                  onClick={switchToRitual}
                  disabled={isSwitchingChain}
                >
                  {isSwitchingChain ? <Loader2 className="spin" size={13} /> : <Link2 size={13} />}
                  {isSwitchingChain ? "Switching" : "Ritual"}
                </button>
              ) : undefined
            }
          />
          <StatusItem
            icon={Zap}
            label="Gas"
            value={wallet.status === "connected" ? `${wallet.balance ?? "0"} RITUAL` : "connect wallet"}
            tone={wallet.status === "connected" ? "ok" : "wait"}
          />
          <StatusItem
            icon={LockKeyhole}
            label="Escrow"
            value={
              wallet.status === "connected"
                ? wallet.ritualWalletError
                  ? "read failed"
                  : `${wallet.ritualWalletBalance ?? "0"} RITUAL`
                : "connect wallet"
            }
            tone={wallet.status === "connected" && isRitualWalletFunded ? "ok" : "wait"}
          />
        </section>

        {wallet.status === "connected" && wallet.error ? (
          <p className="wallet-status-note" role="alert" aria-live="polite">
            {wallet.error}
          </p>
        ) : null}

        <section className="studio-grid">
          <section className="main-stage" aria-label="Composer">
            <div className="stage-head">
              <div>
                <h2>{stageTitle}</h2>
              </div>
              <span className={readyPillClass} aria-live="polite">
                {isPreviewRecipe ? <CircleDot size={15} /> : openBlockers.length ? <AlertCircle size={15} /> : <Check size={15} />}
                {readinessSummary}
              </span>
            </div>

            <div className="composer-surface explorer-panel">
              <div
                className="recipe-tabs"
                role="tablist"
                aria-label="Precompile recipes"
                onKeyDown={(event) => {
                  const currentIndex = recipes.findIndex((recipe) => recipe.id === activeRecipe);
                  const nextIndex =
                    event.key === "ArrowRight"
                      ? (currentIndex + 1) % recipes.length
                      : event.key === "ArrowLeft"
                        ? (currentIndex - 1 + recipes.length) % recipes.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? recipes.length - 1
                            : -1;
                  if (nextIndex >= 0) {
                    event.preventDefault();
                    selectRecipe(recipes[nextIndex].id, true);
                  }
                }}
              >
                {recipes.map((recipe) => {
                  const Icon = recipe.icon;
                  return (
                    <button
                      key={recipe.id}
                      id={`recipe-tab-${recipe.id}`}
                      className={[
                        "recipe-tab",
                        recipe.id === activeRecipe ? "active" : "",
                        recipe.status === "preview" ? "preview" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectRecipe(recipe.id)}
                      role="tab"
                      aria-selected={recipe.id === activeRecipe}
                      aria-controls={`recipe-panel-${recipe.id}`}
                      aria-label={`${recipe.name} ${RECIPE_STATUS_LABELS[recipe.status]} recipe`}
                      tabIndex={recipe.id === activeRecipe ? 0 : -1}
                    >
                      <Icon size={17} />
                      <span>{recipe.name}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id={`recipe-panel-${selectedRecipe.id}`}
                className="composer-intro"
                role="tabpanel"
                aria-labelledby={`recipe-tab-${selectedRecipe.id}`}
              >
                <p>{selectedRecipe.description}</p>
                <span className={`recipe-support ${selectedRecipe.status}`}>
                  <span aria-hidden="true" />
                  {RECIPE_STATUS_LABELS[selectedRecipe.status]}
                </span>
              </div>

              <div className="preset-controls" aria-label="Recipe presets">
                <label className="preset-label">
                  <span>Preset label</span>
                  <input
                    name={`preset-label-${selectedRecipe.id}`}
                    value={presetLabel}
                    onChange={(event) => setPresetLabel(event.target.value)}
                    placeholder={`Save current ${selectedRecipe.name} fields`}
                  />
                </label>
                <button className="secondary-action" type="button" onClick={saveRecipePreset} disabled={!presetLabel.trim()}>
                  <Clipboard size={15} />
                  Save preset
                </button>
                <label className="preset-select">
                  <span>Saved preset</span>
                  <select
                    name={`saved-preset-${selectedRecipe.id}`}
                    value={selectedPresetId}
                    onChange={(event) => setSelectedPresetId(event.target.value)}
                  >
                    <option value="">Select preset</option>
                    {visibleRecipePresets.map((preset) => (
                      <option value={preset.id} key={preset.id}>
                        {preset.source === "example" ? `${preset.label}` : preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary-action" type="button" onClick={applyRecipePreset} disabled={!selectedPreset}>
                  <RefreshCw size={15} />
                  Load
                </button>
                <button
                  className="secondary-action preset-forget"
                  type="button"
                  onClick={forgetRecipePreset}
                  disabled={!selectedPreset || selectedPreset.source === "example"}
                >
                  Forget
                </button>
                <button
                  className={showPresetTransfer ? "section-toggle open preset-transfer-toggle" : "section-toggle preset-transfer-toggle"}
                  type="button"
                  onClick={() => setShowPresetTransfer((current) => !current)}
                  aria-expanded={showPresetTransfer}
                >
                  <ChevronDown size={15} />
                  JSON
                </button>
              </div>

              {showPresetTransfer ? (
                <div className="preset-transfer">
                  <div className="preset-transfer-actions">
                    <button className="secondary-action" type="button" onClick={copySelectedPresetJson} disabled={!selectedPreset}>
                      {copiedPresetJson ? <Check size={15} /> : <Download size={15} />}
                      {copiedPresetJson ? "Copied" : "Copy selected"}
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={importRecipePresetJson}
                      disabled={!presetImportValue.trim()}
                    >
                      <Upload size={15} />
                      Import JSON
                    </button>
                  </div>
                  <textarea
                    name={`preset-json-${selectedRecipe.id}`}
                    value={presetImportValue}
                    onChange={(event) => setPresetImportValue(event.target.value)}
                    placeholder="Paste a Precompile Studio preset JSON"
                    spellCheck={false}
                  />
                  {presetTransferMessage ? <p>{presetTransferMessage}</p> : null}
                </div>
              ) : null}

              <div className="field-grid">
                {selectedFields.map((field) => {
                  const isWideField = field.type === "textarea" || field.key === "url";
                  return (
                    <label className={isWideField ? "field wide" : "field"} key={field.key}>
                      <span>{field.label}</span>
                      {field.type === "textarea" ? (
                        <textarea
                          name={`${selectedRecipe.id}-${field.key}`}
                          value={field.value}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        />
                      ) : field.type === "select" ? (
                        <select
                          name={`${selectedRecipe.id}-${field.key}`}
                          value={field.value}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        >
                          {field.options?.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name={`${selectedRecipe.id}-${field.key}`}
                          value={field.value}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="composer-actions">
                <button className="secondary-action" onClick={copyPreview}>
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? "Copied" : "Copy draft"}
                </button>
                {selectedRecipe.status === "live" && !["jq", "llm", "agent"].includes(selectedRecipe.id) ? (
                  <button
                    className="secondary-action"
                    onClick={copyCallRequest}
                    disabled={!callRequest}
                    title={directCallUnavailableReason}
                  >
                    {copiedCallRequest ? <Check size={16} /> : <Code2 size={16} />}
                    {copiedCallRequest ? "Copied call" : directCallUnavailableReason ? "Contract only" : "Copy call JSON"}
                  </button>
                ) : null}
                {selectedRecipe.status === "live" && !["jq", "llm", "agent"].includes(selectedRecipe.id) ? (
                  <button
                    className="secondary-action"
                    onClick={copyCastCommand}
                    disabled={!castCommand}
                    title={directCallUnavailableReason}
                  >
                    {copiedCastCommand ? <Check size={16} /> : <TerminalSquare size={16} />}
                    {copiedCastCommand ? "Copied cast" : directCallUnavailableReason ? "Contract only" : "Copy cast"}
                  </button>
                ) : null}
                {selectedRecipe.status === "live" ? (
                  <button
                    className={["jq", "llm", "scheduler"].includes(selectedRecipe.id) ? "secondary-action" : "primary-action large"}
                    onClick={copyEncodedInput}
                    disabled={!canCopyEncoded}
                  >
                    {copiedEncoded ? <Check size={16} /> : <Clipboard size={16} />}
                    {encodedActionLabel}
                  </button>
                ) : null}
                {selectedRecipe.id === "jq" ? (
                  <button
                    className="primary-action large"
                    type="button"
                    onClick={executeJq}
                    disabled={!jqDraft.encodedInput || jqCallState.status === "running"}
                  >
                    {jqCallState.status === "running" ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
                    {jqCallState.status === "running" ? "Running" : "Run JQ"}
                  </button>
                ) : null}
                {selectedRecipe.id === "llm" ? (
                  <button className="primary-action large" type="button" onClick={sendLlmTransaction} disabled={!canSendLlm}>
                    {llmTxState.status === "submitting" ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
                    {llmTxState.status === "submitting" ? "Confirming" : "Send LLM"}
                  </button>
                ) : null}
                {selectedRecipe.id === "scheduler" ? (
                  <button
                    className="primary-action large"
                    type="button"
                    onClick={scheduledJqState.status === "missing" ? createScheduledJqConsumer : submitScheduledJq}
                    disabled={scheduledJqState.status === "missing" ? !canCreateScheduledJqConsumer : !canCreateSchedule}
                  >
                    {schedulerTxState.status === "submitting" ? (
                      <Loader2 className="spin" size={16} />
                    ) : scheduledJqState.status === "missing" ? (
                      <Upload size={16} />
                    ) : (
                      <Activity size={16} />
                    )}
                    {schedulerTxState.status === "submitting"
                      ? schedulerTxState.action === "deploy" ? "Creating" : "Confirming"
                      : scheduledJqState.status === "missing"
                        ? "Create consumer"
                      : schedulerShortfall > 0n
                        ? "Fund & schedule"
                        : "Schedule JQ"}
                  </button>
                ) : null}
              </div>
              {selectedRecipe.id === "jq" && jqCallState.status !== "idle" ? (
                <div
                  className={`jq-result ${jqCallState.status}`}
                  aria-live="polite"
                  data-testid="jq-result"
                >
                  <div className="jq-result-head">
                    <span>JQ result</span>
                    <strong>
                      {jqCallState.status === "running"
                        ? "Calling 0x0803"
                        : jqCallState.status === "empty"
                          ? "No output"
                          : jqCallState.status === "error"
                            ? "Call failed"
                            : jqCallState.result.isEmpty
                              ? `Valid empty ${jqCallState.result.outputType}`
                              : jqCallState.result.outputType}
                    </strong>
                  </div>
                  {jqCallState.status === "running" ? (
                    <p>The synchronous precompile is evaluating this query. No wallet or gas is required.</p>
                  ) : jqCallState.status === "empty" ? (
                    <p>The query returned no bytes. Check that the JSON path exists and matches the selected output type.</p>
                  ) : jqCallState.status === "error" ? (
                    <p>{jqCallState.error}</p>
                  ) : (
                    <pre>{jqCallState.result.isEmpty ? jqCallState.result.display || '""' : jqCallState.result.display}</pre>
                  )}
                </div>
              ) : null}
              {selectedRecipe.id === "llm" && (llmRun || llmTxState.status === "error") ? (
                <div
                  className={`jq-result llm-result ${llmEvidence?.status ?? llmRun?.status ?? "error"}`}
                  aria-live="polite"
                  data-testid="llm-result"
                >
                  <div className="jq-result-head">
                    <span>LLM result</span>
                    <strong>
                      {llmTxState.status === "error"
                        ? "Submission failed"
                        : llmRun?.status === "pending"
                          ? "Waiting for settlement"
                          : llmRun?.status === "failed"
                            ? "Transaction failed"
                            : llmEvidence?.status === "precompile-error"
                              ? "Model error"
                              : llmEvidence
                                ? "Completion ready"
                                : "No output found"}
                    </strong>
                  </div>
                  <div className="llm-result-body">
                    {llmTxState.status === "error" ? <p>{llmTxState.error}</p> : null}
                    {llmRun ? (
                      <a href={explorerTransactionUrl(llmRun.hash)} target="_blank" rel="noreferrer">
                        {formatHash(llmRun.hash)} <ArrowUpRight size={13} />
                      </a>
                    ) : null}
                    {llmRun?.status === "pending" ? <p>Ritual is waiting for the TEE executor and settlement transaction.</p> : null}
                    {llmRun?.error ? <p>{llmRun.error}</p> : null}
                    {llmEvidence?.result.errorMessage ? <p className="llm-error-message">{llmEvidence.result.errorMessage}</p> : null}
                    {llmEvidence?.result.completionText ? <pre>{llmEvidence.result.completionText}</pre> : null}
                    {llmEvidence?.result.completion ? (
                      <div className="llm-result-meta">
                        <span>{llmEvidence.result.completion.model}</span>
                        {llmEvidence.result.completion.finishReason ? <span>{llmEvidence.result.completion.finishReason}</span> : null}
                        {llmEvidence.result.completion.totalTokens ? <span>{llmEvidence.result.completion.totalTokens} tokens</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {selectedRecipe.id === "scheduler" ? (
                <div className="scheduler-workflow" data-testid="scheduler-workflow">
                  <div className="scheduler-workflow-head">
                    <div>
                      <span>{isScheduledJqDemo ? "Scheduled JQ demo" : "Your Scheduled JQ consumer"}</span>
                      <strong>
                        {scheduledJqState.status === "loading" || scheduledJqState.status === "idle"
                          ? "Reading onchain state"
                          : scheduledJqState.status === "error"
                            ? "Consumer unavailable"
                            : scheduledJqState.status === "missing"
                              ? "Consumer not created"
                            : hasActiveSchedule
                              ? SCHEDULE_STATE_LABELS[scheduledJqStatus?.scheduleState ?? 0]
                              : scheduledJqStatus?.lastScheduleId
                                ? SCHEDULE_STATE_LABELS[scheduledJqStatus.scheduleState] ?? "Idle"
                                : "Ready to schedule"}
                      </strong>
                    </div>
                    <button
                      className="section-toggle"
                      type="button"
                      onClick={() => refreshScheduledJq().catch(() => undefined)}
                      disabled={scheduledJqState.status === "loading" || schedulerTxState.status === "submitting"}
                    >
                      {scheduledJqState.status === "loading" ? <Loader2 className="spin" size={13} /> : <RefreshCw size={13} />}
                      Refresh
                    </button>
                  </div>

                  <div className="scheduler-facts">
                    <div>
                      <span>Consumer</span>
                      <code>{scheduledJqConsumerAddress ? formatAddress(scheduledJqConsumerAddress) : "Checking"}</code>
                    </div>
                    <div className={isScheduledJqOwner || scheduledJqState.status === "missing" ? "ok" : "pending"}>
                      <span>Owner</span>
                      <strong>
                        {scheduledJqState.status === "missing"
                          ? "Connected wallet"
                          : scheduledJqStatus
                            ? isScheduledJqOwner
                              ? "Connected"
                              : formatAddress(scheduledJqStatus.owner)
                            : "Checking"}
                      </strong>
                    </div>
                    <div className={schedulerShortfall === 0n ? "ok" : "pending"}>
                      <span>Consumer escrow</span>
                      <strong>
                        {scheduledJqState.status === "missing"
                          ? "After creation"
                          : scheduledJqStatus
                            ? `${formatRitual(scheduledJqStatus.balance)} RITUAL`
                            : "Checking"}
                      </strong>
                    </div>
                    <div>
                      <span>Last call</span>
                      <strong>{scheduledJqState.status === "missing" ? "New" : scheduledJqStatus?.lastScheduleId ? `#${scheduledJqStatus.lastScheduleId}` : "None"}</strong>
                    </div>
                  </div>

                  {scheduledJqState.status === "missing" ? (
                    <div className="scheduler-setup" role="status">
                      <div>
                        <span>One-time setup</span>
                        <p>Deploy the predicted consumer once. This wallet will own its schedules, escrow, and withdrawals.</p>
                      </div>
                      <code>{formatAddress(SCHEDULED_JQ_FACTORY_ADDRESS)}</code>
                    </div>
                  ) : null}

                  <div className="scheduler-budget">
                    <div>
                      <span>Required escrow</span>
                      <strong>{formatRitual(scheduleDraft.requiredBalance)} RITUAL</strong>
                    </div>
                    <p>
                      Includes the Scheduler&apos;s 0.01 RITUAL reserve and {scheduleDraft.numCalls.toString()} execution
                      {scheduleDraft.numCalls === 1n ? "" : "s"}. {schedulerShortfall > 0n
                        ? `${formatRitual(schedulerShortfall)} RITUAL will be deposited in the same transaction.`
                        : "The consumer is funded for this schedule."}
                    </p>
                  </div>

                  <div className="scheduler-controls">
                    <span>
                      {schedulerLockRemaining === undefined
                        ? scheduledJqState.status === "missing" ? "Escrow starts after consumer creation" : "Escrow lock pending"
                        : schedulerLockRemaining > 0
                          ? `Escrow unlocks in ${schedulerLockRemaining.toLocaleString()} blocks`
                          : "Escrow is unlocked"}
                    </span>
                    <div>
                      <button className="secondary-action" type="button" onClick={cancelScheduledJq} disabled={!canCancelSchedule}>
                        {schedulerTxState.status === "submitting" && schedulerTxState.action === "cancel" ? <Loader2 className="spin" size={14} /> : <X size={14} />}
                        Cancel
                      </button>
                      <button className="secondary-action" type="button" onClick={withdrawScheduledJq} disabled={!canWithdrawScheduler}>
                        {schedulerTxState.status === "submitting" && schedulerTxState.action === "withdraw" ? <Loader2 className="spin" size={14} /> : <Download size={14} />}
                        Withdraw
                      </button>
                    </div>
                  </div>

                  {scheduledJqState.status === "error" ? <p className="scheduler-message error">{scheduledJqState.error}</p> : null}
                  {schedulerTxState.status === "error" ? <p className="scheduler-message error">{schedulerTxState.error}</p> : null}
                  {schedulerTxState.hash ? (
                    <p className="scheduler-message">
                      Transaction <a href={explorerTransactionUrl(schedulerTxState.hash)} target="_blank" rel="noreferrer">{formatHash(schedulerTxState.hash)} <ArrowUpRight size={12} /></a>
                    </p>
                  ) : null}
                  {schedulerResult ? (
                    <div className="scheduler-result" aria-live="polite">
                      <div>
                        <span>Latest execution</span>
                        <strong>{schedulerResult.outputType}</strong>
                      </div>
                      <pre>{schedulerResult.display}</pre>
                    </div>
                  ) : null}
                  {scheduledJqStatus?.lifecycle.length ? (
                    <div className="scheduler-lifecycle" aria-label="Latest schedule lifecycle">
                      <div className="scheduler-lifecycle-head">
                        <span>Onchain lifecycle</span>
                        <strong>Call #{scheduledJqStatus.lastScheduleId.toString()}</strong>
                      </div>
                      <ol>
                        {scheduledJqStatus.lifecycle.slice(-8).map((entry, index) => (
                          <li className={entry.tone} key={`${entry.kind}-${entry.blockNumber ?? index}-${index}`}>
                            <span className="scheduler-lifecycle-icon" aria-hidden="true">
                              {entry.tone === "ok" ? <Check size={13} /> : entry.tone === "bad" ? <X size={13} /> : entry.tone === "warning" ? <AlertCircle size={13} /> : <CircleDot size={13} />}
                            </span>
                            <div>
                              <strong>{entry.label}</strong>
                              <p>{entry.detail}</p>
                            </div>
                            {entry.transactionHash ? (
                              <a href={explorerTransactionUrl(entry.transactionHash)} target="_blank" rel="noreferrer" aria-label={`${entry.label} transaction`}>
                                {entry.blockNumber ? `#${entry.blockNumber.toLocaleString()}` : "Tx"} <ArrowUpRight size={12} />
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedRecipe.id === "agent" ? (
                <div className="agent-launch" data-testid="agent-launch">
                  <div className="agent-launch-head">
                    <div>
                      <span>Sovereign Agent harness</span>
                      <strong>
                        {agentHarnessState.status === "loading"
                          ? "Reading onchain state"
                          : agentHarnessState.status === "error"
                            ? "Harness unavailable"
                            : agentLifecycle?.status === "settled"
                              ? "Agent result delivered"
                              : agentLifecycle?.status === "failed" || agentLifecycle?.status === "expired"
                                ? agentLifecycle.status === "expired" ? "Agent job expired" : "Agent job failed"
                                : agentLifecycle?.status === "result-ready"
                                  ? "TEE result ready"
                                  : agentHarnessStatus?.configured
                                    ? agentHarnessStatus.senderLocked
                                      ? "Agent job processing"
                                      : "Recurring series active"
                              : "Ready to configure"}
                      </strong>
                    </div>
                    <button
                      className="section-toggle"
                      type="button"
                      onClick={() => {
                        refreshAgentHarness()
                          .then((status) => refreshAgentLifecycle(status?.configured ?? false))
                          .catch(() => undefined);
                      }}
                      disabled={agentHarnessState.status === "loading"}
                    >
                      {agentHarnessState.status === "loading" ? <Loader2 className="spin" size={13} /> : <RefreshCw size={13} />}
                      Refresh
                    </button>
                  </div>
                  <div className="agent-launch-facts">
                    <div>
                      <span>Harness</span>
                      <code>{formatAddress(SOVEREIGN_AGENT_HARNESS_ADDRESS)}</code>
                    </div>
                    <div className={isAgentHarnessOwner ? "ok" : "pending"}>
                      <span>Owner</span>
                      <strong>
                        {agentHarnessStatus
                          ? isAgentHarnessOwner
                            ? "Connected"
                            : formatAddress(agentHarnessStatus.owner)
                          : "Checking"}
                      </strong>
                    </div>
                    <div className={selectedDiscoveredExecutor?.publicKey ? "ok" : "pending"}>
                      <span>Executor key</span>
                      <strong>{selectedDiscoveredExecutor?.publicKey ? "Registry verified" : "Select discovered"}</strong>
                    </div>
                    <div>
                      <span>Series</span>
                      <strong>
                        {!agentHarnessStatus?.currentSeriesId || agentHarnessStatus.currentSeriesId === "0"
                          ? "Not started"
                          : `#${agentHarnessStatus.currentSeriesId}`}
                      </strong>
                    </div>
                  </div>
                  <div className="agent-launch-controls">
                    <label>
                      <span>Scheduler funding</span>
                      <div className="agent-funding-input">
                        <input
                          name="agent-funding"
                          inputMode="decimal"
                          value={agentFundingAmount}
                          onChange={(event) => setAgentFundingAmount(event.target.value)}
                        />
                        <small>RITUAL</small>
                      </div>
                    </label>
                    <p>5 calls · every 2,000 blocks · 100,000-block funding lock</p>
                    <button className="primary-action large" type="button" onClick={startAgent} disabled={!canStartAgent}>
                      {agentTxState.status === "submitting" ? <Loader2 className="spin" size={16} /> : <Route size={16} />}
                      {agentTxState.status === "submitting"
                        ? "Confirming"
                        : agentHarnessStatus?.configured
                          ? "Agent active"
                          : "Start Agent"}
                    </button>
                  </div>
                  {agentHarnessState.status === "error" ? <p className="agent-launch-message error">{agentHarnessState.error}</p> : null}
                  {agentLifecycleState.status === "error" ? <p className="agent-launch-message error">{agentLifecycleState.error}</p> : null}
                  {agentTxState.status === "error" ? <p className="agent-launch-message error">{agentTxState.error}</p> : null}
                  {agentRun ? (
                    <div className={`agent-run ${agentRun.status}`} aria-live="polite">
                      <span>{agentRun.status === "pending" ? "Launch submitted" : agentRun.status === "confirmed" ? "Harness configured" : "Launch failed"}</span>
                      <a href={explorerTransactionUrl(agentRun.hash)} target="_blank" rel="noreferrer">
                        {formatHash(agentRun.hash)} <ArrowUpRight size={13} />
                      </a>
                      {agentRun.receipt?.blockNumber ? (
                        <small>block {Number(BigInt(agentRun.receipt.blockNumber)).toLocaleString()}</small>
                      ) : null}
                      {agentRun.error ? <small>{agentRun.error}</small> : null}
                    </div>
                  ) : null}
                  {agentLifecycle?.jobId ? (
                    <div className={`agent-lifecycle ${agentLifecycle.status}`} aria-live="polite">
                      <div>
                        <span>Latest Agent job</span>
                        <strong>
                          {agentLifecycle.status === "committed"
                            ? "TEE processing"
                            : agentLifecycle.status === "result-ready"
                              ? "Awaiting callback"
                              : agentLifecycle.status === "settled"
                                ? "Result delivered"
                                : agentLifecycle.status === "expired"
                                  ? "Job expired"
                                  : "Job failed"}
                        </strong>
                      </div>
                      <code>{formatHash(agentLifecycle.jobId)}</code>
                      {agentLifecycle.executor ? <small>executor {formatAddress(agentLifecycle.executor)}</small> : null}
                      {agentLifecycle.result?.text ? <p>{agentLifecycle.result.text}</p> : null}
                      {agentLifecycle.result?.error ? <p className="error">{agentLifecycle.result.error}</p> : null}
                      {agentLifecycle.error ? <p className="error">{agentLifecycle.error}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {copyFeedback ? (
                <p className={`copy-feedback ${copyFeedback.tone}`} aria-live="polite">
                  {copyFeedback.message}
                </p>
              ) : null}
            </div>

            {activeAbiDraft ? (
              <div className="abi-panel utility-panel">
                <div className="section-head">
                  <div>
                    <span>{activeAbiDraft.label} ABI</span>
                    <strong>{activeAbiDraft.encodedInput ? "Encoded input ready" : "Input needs attention"}</strong>
                  </div>
                  <button
                    className={showAbiDetails ? "section-toggle open" : "section-toggle"}
                    type="button"
                    onClick={() => setShowAbiDetails((current) => !current)}
                    aria-expanded={showAbiDetails}
                  >
                    <ChevronDown size={15} />
                    {showAbiDetails ? "Hide" : "Show"}
                  </button>
                </div>
                {showAbiDetails ? <code>{activeAbiDraft.abi}</code> : null}
                <div className="abi-facts">
                  {activeAbiDraft.facts.map((fact) => (
                    <button
                      type="button"
                      onClick={() => copyValue(fact.copyValue)}
                      title={`Copy ${fact.label} ${fact.copyValue}`}
                      key={fact.label}
                    >
                      {fact.label} {fact.value}
                    </button>
                  ))}
                </div>
                {activeAbiDraft.errors.length ? (
                  <div className="abi-errors" role="alert" aria-live="polite">
                    {activeAbiDraft.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasExecutorField ? (
              <div className="executor-panel utility-panel">
                <div className="section-head">
                  <div>
                    <span>TEE executor</span>
                    <strong>{selectedExecutorAddressOk ? "Executor selected" : "Registered executor needed"}</strong>
                  </div>
                </div>
                <div className={selectedExecutorAddressOk ? "executor-current ok" : "executor-current pending"}>
                  {selectedExecutorAddressOk ? <Check size={13} /> : <AlertCircle size={13} />}
                  <span>
                    {selectedExecutorAddressOk ? formatAddress(cleanSelectedExecutorAddress) : "No registered executor selected"}
                  </span>
                  <small>from {selectedRecipe.name} field</small>
                </div>
                <div className="executor-discovery">
                  <div className="runner-history-head">
                    <div>
                      <span>Registry discovery</span>
                      <small>{SYSTEM_CONTRACTS.TEEServiceRegistry}</small>
                    </div>
                    <button
                      className="section-toggle"
                      type="button"
                      onClick={() => refreshExecutorDiscovery().catch(() => undefined)}
                      disabled={executorDiscovery.status === "loading"}
                    >
                      {executorDiscovery.status === "loading" ? <Loader2 className="spin" size={13} /> : <RefreshCw size={13} />}
                      Refresh
                    </button>
                  </div>
                  <div className="executor-discovery-controls">
                    <label>
                      <span>Capability</span>
                      <select
                        id="executor-capability"
                        name="executor-capability"
                        value={executorDiscovery.capabilityId}
                        onChange={(event) => selectExecutorCapability(Number(event.target.value))}
                      >
                        {EXECUTOR_CAPABILITIES.map((capability) => (
                          <option key={capability.id} value={capability.id}>
                            {capability.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      {executorDiscovery.status === "ready"
                        ? `${executorDiscovery.total ?? executorDiscovery.executors.length} registered; showing ${executorDiscovery.executors.length}.`
                        : executorDiscovery.status === "loading"
                          ? "Reading TEEServiceRegistry..."
                          : executorDiscovery.status === "error"
                            ? executorDiscovery.error
                            : "Choose a capability to load registered executors."}
                    </p>
                  </div>
                  {executorDiscovery.executors.length ? (
                    <div className="executor-discovery-list">
                      {executorDiscovery.executors.map((executor, index) => (
                        <div className="discovered-executor" key={`${executor.capabilityId}-${executor.address}`}>
                          <button type="button" onClick={() => useDiscoveredExecutor(executor)}>
                            <span>{capabilityLabel(executor.capabilityId)} #{index + 1}</span>
                            <code>{formatAddress(executor.address)}</code>
                          </button>
                          <button type="button" onClick={() => useDiscoveredExecutor(executor)}>
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="runner-save-row">
                  <label>
                    <span>Executor label</span>
                    <input
                      name="executor-label"
                      value={executorLabel}
                      onChange={(event) => setExecutorLabel(event.target.value)}
                      placeholder={
                        selectedExecutorAddressOk
                          ? activeSavedExecutor?.label ?? defaultExecutorLabel(cleanSelectedExecutorAddress)
                          : "TEE executor"
                      }
                    />
                  </label>
                  <button className="secondary-action" type="button" onClick={saveExecutor} disabled={!selectedExecutorAddressOk}>
                    <KeyRound size={15} />
                    {activeSavedExecutor ? "Update" : "Save"}
                  </button>
                </div>
                <div className="runner-saved">
                  <div className="runner-history-head">
                    <span>Saved executors</span>
                    <strong>{executorStorageScope === "local" ? "local" : formatAddress(wallet.address)}</strong>
                  </div>
                  {savedExecutors.length ? (
                    <div className="saved-runner-list">
                      {savedExecutors.map((executor) => (
                        <div className="saved-runner" key={executor.address}>
                          <button type="button" onClick={() => useSavedExecutor(executor.address)}>
                            <span>{executor.label}</span>
                            <code>{formatAddress(executor.address)}</code>
                          </button>
                          <button
                            className="saved-runner-forget"
                            type="button"
                            onClick={() => forgetSavedExecutor(executor.address)}
                            aria-label={`Forget ${executor.label}`}
                          >
                            Forget
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Save a registry executor after you confirm one.</p>
                  )}
                </div>
              </div>
            ) : null}

            {selectedRecipe.id === "http" ? (
              <div className="runner-panel utility-panel">
                <div className="section-head">
                  <div>
                    <span>HTTP transaction</span>
                    <strong>{runnerCalldata ? "Calldata prepared" : "Resolve ABI input first"}</strong>
                  </div>
                </div>
                <label className="runner-address">
                  <span>HTTP consumer</span>
                  <input
                    name="runner-contract"
                    value={runnerAddress}
                    onChange={(event) => setRunnerAddress(event.target.value)}
                    placeholder="0x..."
                    spellCheck={false}
                  />
                </label>
                <div className="runner-save-row">
                  <label>
                    <span>Consumer label</span>
                    <input
                      name="runner-label"
                      value={runnerLabel}
                      onChange={(event) => setRunnerLabel(event.target.value)}
                      placeholder={runnerAddressOk ? activeSavedRunner?.label ?? defaultRunnerLabel(cleanRunnerAddress) : "HTTP consumer"}
                    />
                  </label>
                  <button className="secondary-action" type="button" onClick={saveRunnerContract} disabled={!runnerAddressOk}>
                    <KeyRound size={15} />
                    {activeSavedRunner ? "Update" : "Save"}
                  </button>
                </div>
                <div className="runner-saved">
                  <div className="runner-history-head">
                    <span>Saved consumers</span>
                    <strong>{runnerStorageScope === "local" ? "local" : formatAddress(wallet.address)}</strong>
                  </div>
                  {savedRunners.length ? (
                    <div className="saved-runner-list">
                      {savedRunners.map((runner) => (
                        <div className="saved-runner" key={runner.address}>
                          <button type="button" onClick={() => useSavedRunner(runner.address)}>
                            <span>{runner.label}</span>
                            <code>{formatAddress(runner.address)}</code>
                          </button>
                          <button
                            className="saved-runner-forget"
                            type="button"
                            onClick={() => forgetSavedRunner(runner.address)}
                            aria-label={`Forget ${runner.label}`}
                          >
                            Forget
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No saved HTTP consumers yet.</p>
                  )}
                </div>
                <div className="runner-setup">
                  <button
                    className={showRunnerSetup ? "section-toggle open runner-setup-toggle" : "section-toggle runner-setup-toggle"}
                    type="button"
                    onClick={() => setShowRunnerSetup((current) => !current)}
                    aria-expanded={showRunnerSetup}
                  >
                    <ChevronDown size={15} />
                    Submission checklist
                    <span>{runnerSetupOpenCount ? `${runnerSetupOpenCount} open` : "ready"}</span>
                  </button>
                  {showRunnerSetup ? (
                    <div className="runner-setup-body">
                      <div className="runner-check-list">
                        {runnerSetupChecks.map((check) => (
                          <div className={check.ok ? "runner-check ok" : "runner-check pending"} key={check.label}>
                            {check.ok ? <Check size={13} /> : <AlertCircle size={13} />}
                            <span>{check.label}</span>
                            <small>{check.detail}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="runner-actions">
                  <button className="secondary-action" type="button" onClick={copyRunnerCalldata} disabled={!runnerCalldata}>
                    {copiedRunnerCalldata ? <Check size={16} /> : <Clipboard size={16} />}
                    {copiedRunnerCalldata ? "Copied calldata" : "Copy calldata"}
                  </button>
                  <button className="primary-action" type="button" onClick={sendRunnerTransaction} disabled={!canSendRunner}>
                    {runnerTxState.status === "submitting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
                    {runnerTxState.status === "submitting" ? "Confirming" : "Send HTTP tx"}
                  </button>
                </div>
                {!runnerAddressOk && cleanRunnerAddress ? <p>Consumer address must be a valid contract address.</p> : null}
                {runnerTxState.status === "submitted" ? <p>Submitted {formatHash(runnerTxState.hash)}</p> : null}
                {runnerTxState.status === "error" ? <p>{runnerTxState.error}</p> : null}
                <div className="runner-history" aria-live="polite">
                  <div className="runner-history-head">
                    <div>
                      <span>Recent HTTP txs</span>
                      <small>{runnerHistoryScopeLabel}</small>
                    </div>
                    <div className="runner-history-tools">
                      {runnerRuns.length ? <strong>{runnerHistoryCounts[runnerHistoryFilter]}</strong> : null}
                      <button
                        className={showRunnerHistoryTransfer ? "runner-history-toggle open" : "runner-history-toggle"}
                        type="button"
                        onClick={() => setShowRunnerHistoryTransfer((current) => !current)}
                        aria-expanded={showRunnerHistoryTransfer}
                      >
                        JSON
                      </button>
                      {runnerRuns.length ? (
                        <button className="runner-history-clear" type="button" onClick={clearRunnerHistory}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="runner-import">
                    <label>
                      <span>Import tx hash</span>
                      <input
                        name="runner-import-transaction-hash"
                        value={importTxHash}
                        onChange={(event) => {
                          setImportTxHash(event.target.value);
                          if (importTxState.status !== "checking") setImportTxState({ status: "idle" });
                        }}
                        placeholder="0x..."
                        spellCheck={false}
                      />
                    </label>
                    <button className="secondary-action" type="button" onClick={importRunnerTransaction} disabled={!canImportTx}>
                      {importTxState.status === "checking" ? <Loader2 className="spin" size={15} /> : <ArrowUpRight size={15} />}
                      {importTxState.status === "checking" ? "Checking" : "Import"}
                    </button>
                  </div>
                  {!importTxHashOk && cleanImportTxHash ? <p>Transaction hash must be 0x plus 64 hex characters.</p> : null}
                  {importTxState.error ? <p>{importTxState.error}</p> : null}
                  {showRunnerHistoryTransfer ? (
                    <div className="runner-history-transfer">
                      <div className="runner-history-transfer-actions">
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={copyRunnerHistoryJson}
                          disabled={!runnerRuns.length}
                        >
                          {copiedRunnerHistory ? <Check size={15} /> : <Download size={15} />}
                          {copiedRunnerHistory ? "Copied" : "Copy history"}
                        </button>
                        <button
                          className="primary-action"
                          type="button"
                          onClick={importRunnerHistoryJson}
                          disabled={!runnerHistoryImportValue.trim()}
                        >
                          <Upload size={15} />
                          Import JSON
                        </button>
                      </div>
                      <textarea
                        name="runner-history-json"
                        value={runnerHistoryImportValue}
                        onChange={(event) => setRunnerHistoryImportValue(event.target.value)}
                        placeholder="Paste Precompile Studio HTTP history JSON"
                        spellCheck={false}
                      />
                      {runnerHistoryMessage ? <p>{runnerHistoryMessage}</p> : null}
                    </div>
                  ) : runnerHistoryMessage ? (
                    <p>{runnerHistoryMessage}</p>
                  ) : null}
                  {runnerRuns.length ? (
                    <div className="runner-history-filter" aria-label="Filter HTTP transactions by status">
                      {RUNNER_HISTORY_FILTERS.map((filter) => (
                        <button
                          className={runnerHistoryFilter === filter.key ? "active" : ""}
                          type="button"
                          key={filter.key}
                          onClick={() => setRunnerHistoryFilter(filter.key)}
                          aria-pressed={runnerHistoryFilter === filter.key}
                        >
                          <span>{filter.label}</span>
                          <code>{runnerHistoryCounts[filter.key]}</code>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {runnerRuns.length && visibleRunnerRuns.length ? (
                    <div className="runner-run-list">
                      {visibleRunnerRuns.map((run) => {
                        const blockNumber = decodeHexNumber(run.receipt?.blockNumber);
                        const gasUsed = decodeHexNumber(run.receipt?.gasUsed);
                        const traceStages = runnerTraceStages(run);
                        const responseEvidence = describeRunnerCallback(run);
                        const response = responseEvidence.result;
                        const responseBody = formatHttpBody(response?.bodyText, response?.contentType);
                        return (
                          <article className={`runner-run ${run.status}`} key={run.hash}>
                            <div className="runner-run-main">
                              <span className="runner-run-status">{run.status}</span>
                              <button type="button" onClick={() => copyValue(run.hash)} title={`Copy ${run.hash}`}>
                                {formatHash(run.hash)}
                              </button>
                            </div>
                            <div className="runner-run-meta">
                              <span>{run.source === "imported" ? "imported" : "wallet"}</span>
                              <span>{run.method}</span>
                              <span title={run.url}>{run.url}</span>
                              <span>{describeSpcCalls(run.receipt)}</span>
                              {blockNumber ? <span>block {blockNumber.toLocaleString()}</span> : null}
                              {gasUsed ? <span>gas {gasUsed.toLocaleString()}</span> : null}
                            </div>
                            <div className="runner-trace-grid" aria-label={`Trace for ${formatHash(run.hash)}`}>
                              {traceStages.map((stage) => (
                                <div className={`runner-trace-step ${stage.tone}`} key={stage.label}>
                                  {stage.tone === "ok" ? <Check size={12} /> : <CircleDot size={12} />}
                                  <span>{stage.label}</span>
                                  <small>{stage.detail}</small>
                                </div>
                              ))}
                            </div>
                            {response ? (
                              <details className={`http-response ${responseEvidence.status}`}>
                                <summary>
                                  <span>Response details</span>
                                  <code>
                                    {response.errorMessage
                                      ? "precompile error"
                                      : response.statusCode !== undefined
                                        ? `HTTP ${response.statusCode}`
                                        : "HTTP output"}
                                  </code>
                                </summary>
                                <div className="http-response-body">
                                  <div className="http-response-facts">
                                    {response.statusCode !== undefined ? (
                                      <span>
                                        <small>Status</small>
                                        <code>{response.statusCode}</code>
                                      </span>
                                    ) : null}
                                    {response.contentType ? (
                                      <span>
                                        <small>Content type</small>
                                        <code>{response.contentType}</code>
                                      </span>
                                    ) : null}
                                    {response.bodyBytes !== undefined ? (
                                      <span>
                                        <small>Body</small>
                                        <code>{response.bodyBytes.toLocaleString()} bytes</code>
                                      </span>
                                    ) : null}
                                  </div>
                                  {response.errorMessage ? <p className="http-response-error">{response.errorMessage}</p> : null}
                                  {response.headers?.length ? (
                                    <details className="http-response-headers">
                                      <summary>{response.headers.length} response headers</summary>
                                      <dl>
                                        {response.headers.map((header, index) => (
                                          <React.Fragment key={`${header.name}-${index}`}>
                                            <dt>{header.name}</dt>
                                            <dd>{header.value}</dd>
                                          </React.Fragment>
                                        ))}
                                      </dl>
                                    </details>
                                  ) : null}
                                  {responseBody ? <pre>{responseBody}</pre> : <p>No readable response body.</p>}
                                </div>
                              </details>
                            ) : null}
                            {run.error ? <p>{run.error}</p> : null}
                            <div className="runner-run-actions">
                              <a href={explorerTransactionUrl(run.hash)} target="_blank" rel="noreferrer">
                                <ArrowUpRight size={13} />
                                Explorer
                              </a>
                              <button type="button" onClick={() => copyValue(runnerTraceJson(run))}>
                                <Clipboard size={13} />
                                Copy trace
                              </button>
                              {run.status === "pending" ? (
                                <button
                                  className="runner-refresh"
                                  type="button"
                                  onClick={() => refreshRunnerReceipt(run.hash)}
                                >
                                  <RefreshCw size={13} />
                                  Check receipt
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : runnerRuns.length ? (
                    <p>No {runnerHistoryFilter} HTTP transactions in this local history.</p>
                  ) : (
                    <p>Submitted HTTP transactions will appear here.</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="preview-shell utility-panel">
              <div className="preview-header">
                <span>Request preview</span>
                <div>
                  <button
                    className={showRequestPreview ? "section-toggle open" : "section-toggle"}
                    type="button"
                    onClick={() => setShowRequestPreview((current) => !current)}
                    aria-expanded={showRequestPreview}
                  >
                    <ChevronDown size={15} />
                    {showRequestPreview ? "Hide JSON" : "Show JSON"}
                  </button>
                  <a href={RITUAL.explorer} target="_blank" rel="noreferrer">
                    Explorer <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
              {showRequestPreview ? <pre>{JSON.stringify(requestPreview, null, 2)}</pre> : null}
            </div>
          </section>

          <aside className="inspector" aria-label="Inspector">
            <div className="inspector-head">
              <div>
                <CircleDot size={17} />
                <span>Inspector</span>
              </div>
            </div>

            <section className="inspector-section">
              <div className="inspector-title compact-title">
                <LockKeyhole size={17} />
                <span>Blocking checks</span>
              </div>
              <div className="guard-list" aria-live="polite">
                {blockingChecks.map((check) => (
                  <Guard key={check.label} ok={check.ok} label={check.label} help={check.help} />
                ))}
              </div>
            </section>

            {wallet.status === "connected" && ["http", "llm"].includes(selectedRecipe.id) ? (
              <section className="inspector-section disclosure-section">
                <button
                  className={showFunding ? "inspector-disclosure open" : "inspector-disclosure"}
                  type="button"
                  onClick={() => setShowFunding((current) => !current)}
                  aria-expanded={showFunding}
                >
                  <span>
                    <Wallet size={17} />
                    RitualWallet funding
                  </span>
                  <ChevronDown size={15} />
                </button>
                {showFunding ? (
                  <div className="funding-panel">
                    <label>
                      <span>Deposit amount</span>
                      <input
                        name="ritual-wallet-deposit-amount"
                        inputMode="decimal"
                        value={depositAmount}
                        onChange={(event) => setDepositAmount(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Lock blocks</span>
                      <input
                        name="ritual-wallet-lock-blocks"
                        inputMode="numeric"
                        value={depositLockBlocks}
                        onChange={(event) => setDepositLockBlocks(event.target.value)}
                      />
                    </label>
                    <button className="primary-action" type="button" onClick={depositToRitualWallet} disabled={!canDeposit}>
                      {depositState.status === "submitting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
                      {depositState.status === "submitting" ? "Confirming" : "Deposit"}
                    </button>
                    {wallet.status === "connected" && !isRightChain ? (
                      <p>Switch to chain 1979 before depositing.</p>
                    ) : null}
                    {depositState.status === "submitted" ? (
                      <p>Submitted {formatHash(depositState.hash)}</p>
                    ) : null}
                    {depositState.status === "error" ? <p>{depositState.error}</p> : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="inspector-section disclosure-section">
              <button
                className={showRunPath ? "inspector-disclosure open" : "inspector-disclosure"}
                type="button"
                onClick={() => setShowRunPath((current) => !current)}
                aria-expanded={showRunPath}
              >
                <span>
                  <Route size={17} />
                  Run path
                </span>
                <ChevronDown size={15} />
              </button>
              {showRunPath ? (
                <ol className="timeline">
                  {timeline.map((item, index) => (
                    <li key={item.title}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            <section className="inspector-section disclosure-section">
              <button
                className={showContracts ? "inspector-disclosure open" : "inspector-disclosure"}
                type="button"
                onClick={() => setShowContracts((current) => !current)}
                aria-expanded={showContracts}
              >
                <span>
                  <KeyRound size={17} />
                  System contracts
                </span>
                <ChevronDown size={15} />
              </button>
              {showContracts ? (
                <div className="contract-list">
                  {Object.entries(SYSTEM_CONTRACTS).map(([name, address]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <code title={address}>{formatAddress(address)}</code>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

          </aside>
        </section>
      </section>
      )}
    </main>
  );
}

function FaqPage({ onStart }: { onStart: () => void }) {
  return (
    <section className="faq-page" aria-labelledby="faq-title">
      <div className="faq-hero">
        <div>
          <span>Precompile Studio guide</span>
          <h1 id="faq-title">FAQ</h1>
          <p>
            A practical guide to what the studio prepares, how to use each flow, what your wallet signs,
            and where Ritual testnet costs come from.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onStart}>
          <Code2 size={16} />
          Open studio
        </button>
      </div>

      <div className="faq-page-grid">
        <aside className="faq-aside" aria-label="How to use Precompile Studio">
          <h2>How to use it</h2>
          <ol>
            {FAQ_WORKFLOW_STEPS.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </aside>

        <div className="faq-content">
          <section className="faq-section">
            <h2>What this service is</h2>
            <p>
              Precompile Studio is not another explorer and not a custodial wallet. It is a browser-based
              composer for Ritual testnet precompile calls. The main job is to make a technical transaction
              understandable before you sign it: inputs, encoded calldata, readiness checks, consumer details,
              and trace evidence all stay visible in one place.
            </p>
            <p>
              Simple example: load the HTTP 200 echo preset, choose a registered executor, and connect MetaMask
              on Ritual. The studio sends the request through a verified HTTP consumer. The history then shows
              the confirmed transaction separately from the HTTP status, headers, and response body returned in
              receipt.spcCalls.
            </p>
          </section>

          <section className="faq-section">
            <h2>Recipe paths</h2>
            <div className="recipe-guide-list">
              <div>
                <strong>HTTP</strong>
                <p>Encode an HTTP request, submit it through a verified consumer, and inspect the returned response.</p>
              </div>
              <div>
                <strong>JQ</strong>
                <p>Run a synchronous JSON query through precompile 0x0803 and decode its typed result without a wallet or gas.</p>
              </div>
              <div>
                <strong>LLM</strong>
                <p>Submit non-streaming inference through the verified consumer and inspect completion, usage, metadata, or executor errors from the settled receipt.</p>
              </div>
              <div>
                <strong>Agent</strong>
                <p>Prepare Sovereign Agent calldata for CLI-style tasks, tools, callbacks, and output refs.</p>
              </div>
              <div>
                <strong>Scheduled JQ</strong>
                <p>Fund and create a future or recurring JQ transform through the deployed consumer, then track execution and recover unused escrow.</p>
              </div>
            </div>
          </section>

          <section className="faq-section">
            <h2>Questions</h2>
            <div className="faq-list">
              {FAQ_ITEMS.map((item, index) => (
                <details key={item.question} open={index < 3}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="faq-section">
            <h2>Costs and safety</h2>
            <p>
              Users pay their own Ritual testnet gas from the connected wallet. The studio does not sponsor
              gas and does not send transactions without a wallet confirmation. Local presets, consumer addresses,
              and HTTP history are saved in browser storage, so they are convenient but not a backend account.
            </p>
            <p>
              Do not paste private keys, seed phrases, or real API secrets into recipe fields. For terminal
              consumer deployment, use a testnet-only private key and keep it outside the repo.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
  tone,
  action,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "ok" | "bad" | "wait";
  action?: React.ReactNode;
}) {
  return (
    <div className={`status-item ${tone}`}>
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong title={value}>{value}</strong>
      </div>
      {action ? <div className="status-action">{action}</div> : null}
    </div>
  );
}

function Guard({ ok, label, help }: { ok: boolean; label: string; help?: string }) {
  return (
    <div className={ok ? "guard ok" : "guard pending"}>
      {ok ? <Check size={13} /> : <AlertCircle size={13} />}
      <span>{label}</span>
      {!ok && help ? <small>{help}</small> : null}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = window.__precompileStudioRoot ?? createRoot(rootElement);
  window.__precompileStudioRoot = root;

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
