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
  Zap,
} from "lucide-react";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  isAddress,
  parseEther,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
} from "viem";
import ritualTestnetDeployment from "../deployments/ritual-testnet.json";
import "./styles.css";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    __precompileStudioRoot?: ReturnType<typeof createRoot>;
  }
}

type Eip1193Provider = {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

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

type RpcReceipt = {
  transactionHash: string;
  blockNumber?: string;
  status?: string;
  gasUsed?: string;
  logs?: unknown[];
  spcCalls?: unknown;
};

type RunnerRun = {
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
};

type RunnerCallbackEvidence = {
  status: "pending" | "complete" | "failed" | "missing";
  detail: string;
  result?: {
    caller?: string;
    statusCode?: number;
    bodyBytes?: number;
    bodyPreview?: string;
    bodyPreviewTruncated?: boolean;
    errorMessage?: string;
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

type RecipePreset = {
  id: string;
  recipeId: RecipeId;
  label: string;
  fields: ComposerField[];
  updatedAt: number;
  source?: "local" | "example";
};

type RecipeId = "http" | "jq" | "llm" | "agent" | "scheduler";

type Recipe = {
  id: RecipeId;
  name: string;
  label: string;
  icon: React.ElementType;
  status: "live" | "preview";
  description: string;
  fields: ComposerField[];
};

type ComposerField = {
  key: string;
  label: string;
  value: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
};

const RITUAL = {
  chainId: 1979,
  chainHex: "0x7bb",
  rpc: "https://rpc.ritualfoundation.org",
  explorer: "https://explorer.ritualfoundation.org",
  faucet: "https://faucet.ritualfoundation.org",
  docs: "https://docs.ritualfoundation.org",
};

const RITUAL_CHAIN_PARAMS = {
  chainId: RITUAL.chainHex,
  chainName: "Ritual Testnet",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: [RITUAL.rpc],
  blockExplorerUrls: [RITUAL.explorer],
};

const SYSTEM_CONTRACTS = {
  RitualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  AsyncJobTracker: "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5",
  TEEServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  Scheduler: "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  AsyncDelivery: "0x5A16214fF555848411544b005f7Ac063742f39F6",
} as const;

const HTTP_CALL_PRECOMPILE = "0x0000000000000000000000000000000000000801";
const LLM_INFERENCE_PRECOMPILE = "0x0000000000000000000000000000000000000802";
const JQ_PRECOMPILE = "0x0000000000000000000000000000000000000803";
const SOVEREIGN_AGENT_PRECOMPILE = "0x000000000000000000000000000000000000080c";
const HTTP_ABI_SIGNATURE =
  "address, bytes[], uint256, bytes[], bytes, string, uint8, string[], string[], bytes, uint256, uint8, bool";
const LLM_ABI_SIGNATURE =
  "address, bytes[], uint256, bytes[], bytes, string, string, int256, string, bool, int256, string, string, uint256, bool, int256, string, bytes, int256, string, string, bool, int256, bytes, bytes, int256, int256, string, bool, (string,string,string)";
const JQ_ABI_SIGNATURE = "string, string, uint8";
const SOVEREIGN_AGENT_ABI_SIGNATURE =
  "address, uint256, bytes, uint64, uint64, string, address, bytes4, uint256, uint256, uint256, uint16, string, bytes, (string,string,string), (string,string,string), (string,string,string)[], (string,string,string), string, string[], uint16, uint32, string";
const EXECUTOR_STORAGE_PREFIX = "precompile-studio:executors";
const RUNNER_STORAGE_PREFIX = "precompile-studio:runners";
const RUNNER_HISTORY_STORAGE_PREFIX = "precompile-studio:runner-history";
const RUNNER_HISTORY_LIMIT = 5;
const CALLBACK_BODY_PREVIEW_LIMIT = 140;
const RUNNER_HISTORY_FILTERS: Array<{ key: RunnerHistoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "failed", label: "Failed" },
];
const PRESET_STORAGE_KEY = "precompile-studio:recipe-presets";
const RUNNER_BUILD_COMMAND = "npm run runner:build";
const RUNNER_DEPLOY_COMMAND = "RITUAL_PRIVATE_KEY=0x... npm run runner:deploy";
const RUNNER_GUIDE_URL = "https://github.com/wminister/precompile-studio/blob/main/contracts/README.md";
const DEFAULT_HTTP_RUNNER_ADDRESS = ritualTestnetDeployment.contracts.HttpPrecompileRunner.address;
const DEFAULT_LLM_MODEL = "zai-org/GLM-4.7-FP8";

const FAQ_ITEMS = [
  {
    question: "What exactly does Precompile Studio do?",
    answer:
      "Precompile Studio is a Ritual testnet workbench. It turns human-readable recipe fields into the exact calldata needed for Ritual precompiles, then shows whether your wallet, chain, gas, RitualWallet balance, and selected route are ready before you copy or submit anything.",
  },
  {
    question: "How do I use it from start to finish?",
    answer:
      "Pick a recipe tab, fill the fields, resolve any red ABI or readiness checks, inspect the request preview, then use the available action: copy calldata, copy a direct call export, or send the HTTP runner transaction from your connected wallet.",
  },
  {
    question: "What is the simplest example?",
    answer:
      "Use the HTTP recipe with method GET and a public URL. The studio encodes that HTTP request for Ritual's HTTP precompile. If a runner contract is set and verified, your wallet can submit the runner transaction and later inspect the receipt, spcCalls, and decoded callback evidence.",
  },
  {
    question: "Does the app send transactions automatically?",
    answer:
      "No. The studio prepares and validates data locally in the browser. It only asks your wallet to send a transaction when you explicitly press a send action, and the wallet confirmation is still required.",
  },
  {
    question: "Who pays gas?",
    answer:
      "The connected user pays their own Ritual testnet gas. The studio does not sponsor or relay transactions. For flows that use RitualWallet escrow, the UI shows whether the connected account has escrowed funds available.",
  },
  {
    question: "Why do some buttons say Contract only?",
    answer:
      "Some Ritual flows are not meant to be sent directly from a wallet. Scheduler, for example, expects an approved contract path. In those cases the studio still prepares calldata, but direct call JSON and cast exports are disabled to avoid sending the wrong transaction.",
  },
  {
    question: "What is stored by the app?",
    answer:
      "Drafts, saved presets, runner addresses, and runner history stay in the browser's local storage. The app warns about secret-looking fields before copying or sharing previews.",
  },
  {
    question: "Do I need a private key?",
    answer:
      "Not for normal browser use. Connect your wallet for signing. A private key is only needed if you deploy the optional HTTP runner contract from your terminal, and that should be a testnet-only deployer key.",
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
    body: "Copy calldata or call JSON when the flow supports direct exports. For HTTP runner calls, connect a wallet and send through the runner panel.",
  },
  {
    title: "Trace the result",
    body: "Runner history stores submitted hashes locally, polls receipts, and surfaces spcCalls plus decoded callback evidence when available.",
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

const JQ_OUTPUT_TYPES: Record<string, number> = {
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

const AGENT_CALLBACK_SELECTOR = "0x8ca12055";

const schedulerAbi = [
  {
    type: "function",
    name: "schedule",
    stateMutability: "payable",
    inputs: [
      { name: "data", type: "bytes" },
      { name: "gas", type: "uint32" },
      { name: "startBlock", type: "uint32" },
      { name: "numCalls", type: "uint32" },
      { name: "frequency", type: "uint32" },
      { name: "ttl", type: "uint32" },
      { name: "maxFeePerGas", type: "uint256" },
      { name: "maxPriorityFeePerGas", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "payer", type: "address" },
    ],
    outputs: [],
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

const httpRunnerAbi = [
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

const recipes: Recipe[] = [
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
      { key: "url", label: "URL", value: "https://api.github.com/repos/ritual-net/infernet-ml" },
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
    status: "live",
    description: "30-field LLM input for GLM-4.7 chat completion at precompile 0x0802.",
    fields: [
      { key: "executor", label: "Executor", value: zeroAddress },
      { key: "ttl", label: "TTL blocks", value: "30" },
      {
        key: "messagesJson",
        label: "Messages JSON",
        value: '[{"role":"user","content":"Summarize why Ritual precompiles matter in one sentence."}]',
        type: "textarea",
      },
      { key: "model", label: "Model", value: DEFAULT_LLM_MODEL },
      { key: "temperature", label: "Temperature", value: "0.7" },
      { key: "stream", label: "Streaming", value: "false", type: "select", options: ["false", "true"] },
      { key: "historyPlatform", label: "History platform", value: "gcs" },
      { key: "historyPath", label: "History path", value: "convos/precompile-studio.jsonl" },
      { key: "historyKeyRef", label: "History key ref", value: "GCS_CREDS" },
    ],
  },
  {
    id: "agent",
    name: "Agent",
    label: "Live CLI recipe",
    icon: Route,
    status: "live",
    description: "23-field Sovereign Agent input for CLI execution at precompile 0x080C.",
    fields: [
      { key: "executor", label: "Executor", value: zeroAddress },
      { key: "ttl", label: "TTL blocks", value: "30" },
      { key: "pollInterval", label: "Poll interval", value: "10" },
      { key: "maxPollBlock", label: "Max poll block", value: "200" },
      { key: "taskIdMarker", label: "Task marker", value: "" },
      { key: "callbackAddress", label: "Callback contract", value: zeroAddress },
      { key: "callbackSelector", label: "Callback selector", value: AGENT_CALLBACK_SELECTOR },
      { key: "gasLimit", label: "Callback gas", value: "250000" },
      { key: "maxFeePerGas", label: "Max fee wei", value: "0" },
      { key: "maxPriorityFeePerGas", label: "Priority fee wei", value: "0" },
      { key: "cliType", label: "CLI type", value: "0" },
      {
        key: "prompt",
        label: "Prompt",
        value: "Audit the latest runner trace and return the next onchain action as JSON.",
        type: "textarea",
      },
      { key: "encryptedSecrets", label: "Encrypted secrets", value: "0x", type: "textarea" },
      { key: "historyPlatform", label: "History platform", value: "gcs" },
      { key: "historyPath", label: "History path", value: "agents/precompile-studio/history.jsonl" },
      { key: "historyKeyRef", label: "History key ref", value: "GCS_CREDS" },
      { key: "outputPlatform", label: "Output platform", value: "gcs" },
      { key: "outputPath", label: "Output path", value: "agents/precompile-studio/output.json" },
      { key: "outputKeyRef", label: "Output key ref", value: "GCS_CREDS" },
      { key: "skillsJson", label: "Skills refs JSON", value: "[]", type: "textarea" },
      { key: "systemPromptPlatform", label: "System platform", value: "" },
      { key: "systemPromptPath", label: "System path", value: "" },
      { key: "systemPromptKeyRef", label: "System key ref", value: "" },
      { key: "model", label: "Model", value: "claude-code" },
      { key: "tools", label: "Allowed tools", value: "read,write,shell", type: "textarea" },
      { key: "maxTurns", label: "Max turns", value: "8" },
      { key: "maxTokens", label: "Max tokens", value: "4096" },
      { key: "rpcUrls", label: "RPC URLs", value: RITUAL.rpc, type: "textarea" },
    ],
  },
  {
    id: "scheduler",
    name: "Schedule",
    label: "Live calldata",
    icon: Activity,
    status: "live",
    description: "Scheduler.schedule calldata for future or recurring contract execution.",
    fields: [
      { key: "callbackData", label: "Callback calldata", value: "0x000000000000000000000000000000000000000000000000000000000000000000000000", type: "textarea" },
      { key: "gas", label: "Gas limit", value: "500000" },
      { key: "startBlock", label: "Start block", value: "120" },
      { key: "numCalls", label: "Executions", value: "4" },
      { key: "frequency", label: "Frequency blocks", value: "50" },
      { key: "ttl", label: "TTL blocks", value: "30" },
      { key: "maxFeePerGas", label: "Max fee wei", value: "0" },
      { key: "maxPriorityFeePerGas", label: "Priority fee wei", value: "0" },
      { key: "value", label: "Value wei", value: "0" },
      { key: "payer", label: "Payer", value: zeroAddress },
    ],
  },
];

const builtInRecipePresets: RecipePreset[] = [
  {
    id: "example-http-github-repo",
    recipeId: "http",
    label: "Example: GitHub repo metadata",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("http", [
      { key: "executor", value: zeroAddress },
      { key: "method", value: "GET" },
      { key: "ttl", value: "30" },
      { key: "url", value: "https://api.github.com/repos/ritual-net/infernet-ml" },
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
      { key: "executor", value: zeroAddress },
      { key: "ttl", value: "30" },
      {
        key: "messagesJson",
        value: '[{"role":"user","content":"Summarize why Ritual precompiles matter in one sentence."}]',
      },
      { key: "model", value: DEFAULT_LLM_MODEL },
      { key: "temperature", value: "0.7" },
      { key: "stream", value: "false" },
      { key: "historyPlatform", value: "gcs" },
      { key: "historyPath", value: "convos/precompile-studio.jsonl" },
      { key: "historyKeyRef", value: "GCS_CREDS" },
    ]),
  },
  {
    id: "example-agent-runner-audit",
    recipeId: "agent",
    label: "Example: Runner trace audit",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("agent", [
      { key: "executor", value: zeroAddress },
      { key: "ttl", value: "30" },
      { key: "pollInterval", value: "10" },
      { key: "maxPollBlock", value: "200" },
      { key: "taskIdMarker", value: "" },
      { key: "callbackAddress", value: zeroAddress },
      { key: "callbackSelector", value: AGENT_CALLBACK_SELECTOR },
      { key: "gasLimit", value: "250000" },
      { key: "maxFeePerGas", value: "0" },
      { key: "maxPriorityFeePerGas", value: "0" },
      { key: "cliType", value: "0" },
      {
        key: "prompt",
        value: "Audit the latest runner trace and return the next onchain action as JSON.",
      },
      { key: "encryptedSecrets", value: "0x" },
      { key: "historyPlatform", value: "gcs" },
      { key: "historyPath", value: "agents/precompile-studio/history.jsonl" },
      { key: "historyKeyRef", value: "GCS_CREDS" },
      { key: "outputPlatform", value: "gcs" },
      { key: "outputPath", value: "agents/precompile-studio/output.json" },
      { key: "outputKeyRef", value: "GCS_CREDS" },
      { key: "skillsJson", value: "[]" },
      { key: "systemPromptPlatform", value: "" },
      { key: "systemPromptPath", value: "" },
      { key: "systemPromptKeyRef", value: "" },
      { key: "model", value: "claude-code" },
      { key: "tools", value: "read,write,shell" },
      { key: "maxTurns", value: "8" },
      { key: "maxTokens", value: "4096" },
      { key: "rpcUrls", value: RITUAL.rpc },
    ]),
  },
  {
    id: "example-scheduler-price-check",
    recipeId: "scheduler",
    label: "Example: Recurring callback",
    updatedAt: 0,
    source: "example",
    fields: normalizePresetFields("scheduler", [
      { key: "callbackData", value: "0x000000000000000000000000000000000000000000000000000000000000000000000000" },
      { key: "gas", value: "500000" },
      { key: "startBlock", value: "120" },
      { key: "numCalls", value: "4" },
      { key: "frequency", value: "50" },
      { key: "ttl", value: "30" },
      { key: "maxFeePerGas", value: "0" },
      { key: "maxPriorityFeePerGas", value: "0" },
      { key: "value", value: "0" },
      { key: "payer", value: zeroAddress },
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
  return `HTTP runner ${formatAddress(address)}`;
}

function defaultExecutorLabel(address: string) {
  return `TEE executor ${formatAddress(address)}`;
}

function describeRunnerCodeState(state: RunnerCodeState) {
  if (state.status === "contract") return `${state.byteLength?.toLocaleString() ?? "Verified"} bytecode bytes`;
  if (state.status === "empty") return "No bytecode at this address.";
  if (state.status === "checking") return "Checking bytecode...";
  if (state.status === "error") return state.error ?? "Could not verify bytecode.";
  return "Set a runner address to check bytecode.";
}

function formatBalance(hex?: string) {
  if (!hex) return "0";
  const value = BigInt(hex);
  const whole = value / 10n ** 18n;
  const fractional = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fractional}`;
}

function decodeUintHex(hex?: string) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function decodeHexNumber(hex?: string) {
  if (!hex || hex === "0x") return undefined;
  return Number.parseInt(hex, 16);
}

function receiptStatus(receipt?: RpcReceipt): ReceiptStatus {
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

function hexByteLength(value?: string) {
  if (!value || !/^0x[a-fA-F0-9]*$/.test(value)) return undefined;
  return Math.max(0, Math.floor((value.length - 2) / 2));
}

function decodeHexTextPreview(value?: string) {
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

  const truncated = normalized.length > CALLBACK_BODY_PREVIEW_LIMIT;
  return {
    text: truncated ? `${normalized.slice(0, CALLBACK_BODY_PREVIEW_LIMIT).trimEnd()}...` : normalized,
    truncated,
  };
}

function describeRunnerCallback(run: RunnerRun): RunnerCallbackEvidence {
  if (!run.receipt) {
    return {
      status: "pending",
      detail: "Available after receipt evidence",
    };
  }

  if (run.status === "failed") {
    return {
      status: "failed",
      detail: "Transaction failed before callback",
    };
  }

  const logs = Array.isArray(run.receipt.logs) ? run.receipt.logs.filter(isRpcLog) : [];
  if (!logs.length) {
    return {
      status: "missing",
      detail: "Receipt has no logs",
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
      detail: "No runner logs found",
    };
  }
  const candidateLogs = runnerAddress === zeroAddress ? logs : scopedLogs;

  for (const log of candidateLogs) {
    if (!log.data || !log.topics?.length) continue;
    try {
      const decoded = decodeEventLog({
        abi: httpRunnerAbi,
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
      const bodyPreview = decodeHexTextPreview(args.body);
      const status = errorMessage ? "failed" : "complete";
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
    detail: "No HttpResult event found",
  };
}

function formatSubmittedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function runnerTraceStages(run: RunnerRun) {
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
      label: "Callback",
      tone:
        callback.status === "complete"
          ? ("ok" as const)
          : callback.status === "failed"
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

function parseRunnerRuns(value: string | null): RunnerRun[] {
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

function hasZeroExecutionIndexPlaceholder(calldata: string) {
  const hex = calldata.slice(2);
  if (hex.length < 72) return false;
  return /^0{64}$/i.test(hex.slice(8, 72));
}

function walletErrorCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error) return (error as { code?: number | string }).code;
  if ("data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "originalError" in data) {
      return walletErrorCode((data as { originalError?: unknown }).originalError);
    }
  }
  return undefined;
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

function buildHttpDraft(fields: ComposerField[]) {
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

function buildLlmDraft(fields: ComposerField[]) {
  const executor = fieldValue(fields, "executor").trim();
  const ttlValue = fieldValue(fields, "ttl").trim();
  const ttl = Number(ttlValue);
  const messagesJson = fieldValue(fields, "messagesJson").trim();
  const model = fieldValue(fields, "model").trim();
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
  if (!historyPlatform || !historyPath || !historyKeyRef) {
    errors.push("Conversation history platform, path, and key ref are required.");
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
          -1n,
          "",
          "",
          1n,
          false,
          0n,
          "",
          "0x",
          -1n,
          "",
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
    convoHistory: [historyPlatform, historyPath, historyKeyRef] as const,
    encodedInput,
    errors,
  };
}

function buildJqDraft(fields: ComposerField[]) {
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

function buildAgentDraft(fields: ComposerField[]) {
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
  }
  if (callbackSelector === "0x00000000") {
    errors.push("Callback selector should point to onSovereignAgentResult(bytes32,bytes).");
  }
  if (!prompt) errors.push("Prompt is required.");
  if (!convoHistory.every(Boolean)) {
    errors.push("Conversation history storage ref needs platform, path, and key ref.");
  }
  if (!output.every(Boolean)) {
    errors.push("Output storage ref needs platform, path, and key ref.");
  }
  if (!model) errors.push("Model is required.");
  if (!tools.length) errors.push("At least one allowed tool is required.");
  if (!rpcUrls) errors.push("RPC URLs are required for chain-aware agents.");

  const encodedInput =
    errors.length === 0
      ? encodeAbiParameters(parseAbiParameters(SOVEREIGN_AGENT_ABI_SIGNATURE), [
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
        ])
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
    encodedInput,
    errors,
  };
}

function buildScheduleDraft(fields: ComposerField[]) {
  const errors: string[] = [];
  const callbackData = parseHexBytesField(fieldValue(fields, "callbackData"), "Callback calldata", errors);
  const gasLimit = parseUintField(fieldValue(fields, "gas"), "Gas limit", errors, { min: 1n, max: 4294967295n });
  const startBlock = parseUintField(fieldValue(fields, "startBlock"), "Start block", errors, { min: 1n, max: 4294967295n });
  const numCalls = parseUintField(fieldValue(fields, "numCalls"), "Executions", errors, { min: 1n, max: 4294967295n });
  const frequency = parseUintField(fieldValue(fields, "frequency"), "Frequency", errors, { min: 1n, max: 4294967295n });
  const ttl = parseUintField(fieldValue(fields, "ttl"), "TTL", errors, { min: 1n, max: 500n });
  const maxFeePerGas = parseUintField(fieldValue(fields, "maxFeePerGas"), "Max fee wei", errors);
  const maxPriorityFeePerGas = parseUintField(fieldValue(fields, "maxPriorityFeePerGas"), "Priority fee wei", errors);
  const value = parseUintField(fieldValue(fields, "value"), "Value wei", errors);
  const payer = fieldValue(fields, "payer").trim();

  if ((callbackData.length - 2) / 2 < 36) {
    errors.push("Callback calldata should include a 4-byte selector and uint256 executionIndex placeholder.");
  } else if (!hasZeroExecutionIndexPlaceholder(callbackData)) {
    errors.push("Callback calldata bytes 4-35 must be a zero executionIndex placeholder.");
  }
  if (!isAddress(payer) || payer.toLowerCase() === zeroAddress) {
    errors.push("Set the contract address paying from RitualWallet.");
  }

  const encodedInput =
    errors.length === 0
      ? encodeFunctionData({
          abi: schedulerAbi,
          functionName: "schedule",
          args: [
            callbackData as `0x${string}`,
            Number(gasLimit),
            Number(startBlock),
            Number(numCalls),
            Number(frequency),
            Number(ttl),
            maxFeePerGas,
            maxPriorityFeePerGas,
            value,
            payer as `0x${string}`,
          ],
        })
      : undefined;

  return {
    precompile: "Scheduler",
    callTarget: SYSTEM_CONTRACTS.Scheduler,
    abi: "schedule(bytes data,uint32 gas,uint32 startBlock,uint32 numCalls,uint32 frequency,uint32 ttl,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 value,address payer)",
    callbackData,
    gasLimit,
    startBlock,
    numCalls,
    frequency,
    ttl,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value,
    payer,
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
  const [depositLockBlocks, setDepositLockBlocks] = React.useState("100");
  const [depositState, setDepositState] = React.useState<DepositState>({ status: "idle" });
  const [executorLabel, setExecutorLabel] = React.useState("");
  const [savedExecutors, setSavedExecutors] = React.useState<SavedExecutor[]>([]);
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
  const [runnerCodeState, setRunnerCodeState] = React.useState<RunnerCodeState>({ status: "idle" });
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
  const [copyFeedback, setCopyFeedback] = React.useState<CopyFeedback | undefined>();
  const copyFeedbackTimer = React.useRef<number | undefined>(undefined);

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
  const isRitualWalletFunded = Number.parseFloat(wallet.ritualWalletBalance ?? "0") > 0;
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
  const canCopyEncoded = Boolean(liveAbiDraft?.encodedInput);
  const directCallUnavailableReason =
    selectedRecipe.id === "scheduler"
      ? "Scheduler calls must originate from a contract that approved Scheduler callbacks."
      : undefined;
  const callRequest = React.useMemo(
    () =>
      liveAbiDraft?.encodedInput && !directCallUnavailableReason
        ? {
            chainId: RITUAL.chainId,
            recipe: selectedRecipe.id,
            label: selectedRecipe.name,
            to: liveAbiDraft.callTarget,
            data: liveAbiDraft.encodedInput,
            value: "0",
          }
        : undefined,
    [directCallUnavailableReason, liveAbiDraft?.callTarget, liveAbiDraft?.encodedInput, selectedRecipe.id, selectedRecipe.name],
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
          abi: httpRunnerAbi,
          functionName: "fetchHttp",
          args: [httpDraft.encodedInput as `0x${string}`],
        })
      : undefined;
  const canSendRunner =
    Boolean(runnerCalldata) &&
    runnerAddressOk &&
    runnerCodeState.status === "contract" &&
    wallet.status === "connected" &&
    isRightChain &&
    isRitualWalletFunded &&
    runnerTxState.status !== "submitting";
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
        label: "Runner contract address set",
        detail: runnerAddressOk ? formatAddress(cleanRunnerAddress) : "Deploy runner, then paste its address.",
      },
      {
        ok: runnerCodeState.status === "contract",
        label: "Runner bytecode verified",
        detail: describeRunnerCodeState(runnerCodeState),
      },
      {
        ok: Boolean(activeSavedRunner),
        label: "Runner saved locally",
        detail: activeSavedRunner?.label ?? "Save the deployed address for reuse.",
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
        label: "RitualWallet funded",
        detail:
          wallet.status === "connected"
            ? `${wallet.ritualWalletBalance ?? "0"} RITUAL escrow`
            : "Escrow is checked after wallet connect.",
      },
    ],
    [
      activeSavedRunner,
      cleanHttpExecutorAddress,
      cleanRunnerAddress,
      httpExecutorAddressOk,
      isRightChain,
      isRitualWalletFunded,
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
      {
        ok: wallet.status === "connected" && isRitualWalletFunded,
        label: isRitualWalletFunded ? "RitualWallet funded" : "Fund RitualWallet",
        help:
          wallet.status === "connected"
            ? wallet.ritualWalletError ?? `${wallet.ritualWalletBalance ?? "0"} RITUAL available`
            : "Escrow balance appears after connect.",
      },
      {
        ok: Boolean(liveAbiDraft?.encodedInput) && (liveAbiDraft?.errors.length ?? 1) === 0,
        label:
          selectedRecipe.status === "live"
            ? liveAbiDraft?.errors[0] ?? `${selectedRecipe.name} ABI input encodes`
            : `${liveRecipeLabel} are live recipes`,
        help:
          selectedRecipe.status === "live"
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

    return checks;
  }, [
    isRightChain,
    isRitualWalletFunded,
    liveAbiDraft,
    liveRecipeLabel,
    rpcState.error,
    rpcState.status,
    sensitiveFieldLabels,
    selectedRecipe.name,
    selectedRecipe.status,
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
            ? "Scheduler"
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
              ? "schedule"
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
              ? "system calldata"
              : "planning shell";
  const stageTitle = selectedRecipe.status === "live" ? "Composer" : `${selectedRecipe.name} preview`;
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
                  value: agentDraft.tools.length ? String(agentDraft.tools.length) : "missing",
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
                  { label: "target", value: formatAddress(scheduleDraft.callTarget), copyValue: scheduleDraft.callTarget },
                  { label: "start", value: String(scheduleDraft.startBlock), copyValue: String(scheduleDraft.startBlock) },
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
    const [chainHex, balanceHex] = await Promise.all([
      provider.request<string>({ method: "eth_chainId" }),
      provider.request<string>({ method: "eth_getBalance", params: [account, "latest"] }),
    ]);

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

  const connectWallet = React.useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setWallet({ status: "error", error: "No browser wallet found." });
      return;
    }
    setWallet((current) => ({ ...current, status: "connecting", error: undefined }));
    try {
      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      await refreshWallet(provider, accounts[0]);
    } catch (error) {
      setWallet({ status: "error", error: error instanceof Error ? error.message : "Wallet connection failed." });
    }
  }, [refreshWallet]);

  const switchToRitual = React.useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    const currentAddress = wallet.address;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RITUAL.chainHex }],
      });
      await refreshWallet(provider, currentAddress);
    } catch (switchError) {
      const code = walletErrorCode(switchError);
      if (code !== 4902 && code !== "4902") {
        setWallet((current) => ({
          ...current,
          status: "error",
          error: switchError instanceof Error ? switchError.message : "Could not switch to Ritual.",
        }));
        return;
      }

      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [RITUAL_CHAIN_PARAMS],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: RITUAL.chainHex }],
        });
        await refreshWallet(provider, currentAddress);
      } catch (addError) {
        setWallet((current) => ({
          ...current,
          status: "error",
          error: addError instanceof Error ? addError.message : "Could not add Ritual testnet to wallet.",
        }));
      }
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
          error: error instanceof Error ? error.message : "Could not verify runner bytecode.",
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
    const provider = window.ethereum;
    if (!provider) return;
    refreshWallet(provider).catch(() => undefined);

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts?.[0]) setWallet({ status: "idle" });
      else refreshWallet(provider, accounts[0]).catch(() => undefined);
    };
    const handleChain = () => refreshWallet(provider).catch(() => undefined);

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [refreshWallet]);

  const previewNextStep =
    selectedRecipe.id === "http"
      ? isReady
        ? "Ready for a contract runner call."
        : "Resolve readiness checks before sending."
      : selectedRecipe.id === "scheduler"
        ? scheduleDraft.encodedInput
          ? "Copy Scheduler calldata and call the system Scheduler from an approved contract."
          : "Resolve Scheduler field errors before copying calldata."
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
      runner:
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

  const copyRunnerCalldata = React.useCallback(async () => {
    if (!runnerCalldata) return;
    const copiedToClipboard = await copyText(runnerCalldata, "Runner calldata copied.");
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
    setRunnerHistoryMessage("Runner history cleared.");
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
      "Runner history JSON copied.",
    );
    if (!copiedToClipboard) {
      setRunnerHistoryMessage("Copy failed. Check browser clipboard permissions.");
      return;
    }
    setCopiedRunnerHistory(true);
    setRunnerHistoryMessage("Runner history JSON copied.");
    window.setTimeout(() => setCopiedRunnerHistory(false), 1400);
  }, [copyText, runnerHistoryScopeLabel, runnerRuns]);

  const importRunnerHistoryJson = React.useCallback(() => {
    const imported = parseRunnerHistoryImport(runnerHistoryImportValue);
    if (!imported.length) {
      setRunnerHistoryMessage("Paste valid Precompile Studio runner history JSON.");
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
    const provider = window.ethereum;
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
      const hash = await provider.request<string>({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            to: SYSTEM_CONTRACTS.RitualWallet,
            value: `0x${value.toString(16)}`,
            data: encodeFunctionData({
              abi: ritualWalletAbi,
              functionName: "deposit",
              args: [lockDuration],
            }),
          },
        ],
      });
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

  const sendRunnerTransaction = React.useCallback(async () => {
    const provider = window.ethereum;
    if (!provider || !wallet.address || !runnerCalldata || !runnerAddressOk) {
      setRunnerTxState({ status: "error", error: "Connect wallet, encode HTTP input, and set a runner address." });
      return;
    }

    setRunnerTxState({ status: "submitting" });
    try {
      const hash = await provider.request<string>({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            to: cleanRunnerAddress,
            data: runnerCalldata,
          },
        ],
      });
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
        error: error instanceof Error ? error.message : "Runner transaction was rejected.",
      });
    }
  }, [cleanRunnerAddress, fieldState.http, refreshRunnerReceipt, runnerAddressOk, runnerCalldata, wallet.address]);

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
                <button className="chain-switch-action" type="button" onClick={switchToRitual}>
                  <Link2 size={13} />
                  Ritual
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
                      aria-label={`${recipe.name} ${recipe.status === "preview" ? "preview" : "live"} recipe`}
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
                {selectedRecipe.status === "live" ? (
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
                {selectedRecipe.status === "live" ? (
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
                  <button className="primary-action large" onClick={copyEncodedInput} disabled={!canCopyEncoded}>
                    {copiedEncoded ? <Check size={16} /> : <Clipboard size={16} />}
                    {encodedActionLabel}
                  </button>
                ) : null}
              </div>
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
                    <span>Runner transaction</span>
                    <strong>{runnerCalldata ? "Calldata prepared" : "Resolve ABI input first"}</strong>
                  </div>
                </div>
                <label className="runner-address">
                  <span>Runner contract</span>
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
                    <span>Runner label</span>
                    <input
                      name="runner-label"
                      value={runnerLabel}
                      onChange={(event) => setRunnerLabel(event.target.value)}
                      placeholder={runnerAddressOk ? activeSavedRunner?.label ?? defaultRunnerLabel(cleanRunnerAddress) : "HTTP runner"}
                    />
                  </label>
                  <button className="secondary-action" type="button" onClick={saveRunnerContract} disabled={!runnerAddressOk}>
                    <KeyRound size={15} />
                    {activeSavedRunner ? "Update" : "Save"}
                  </button>
                </div>
                <div className="runner-saved">
                  <div className="runner-history-head">
                    <span>Saved runners</span>
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
                    <p>No saved runner contracts yet.</p>
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
                    Deployment checklist
                    <span>{runnerSetupOpenCount ? `${runnerSetupOpenCount} open` : "ready"}</span>
                  </button>
                  {showRunnerSetup ? (
                    <div className="runner-setup-body">
                      <div className="runner-command-list">
                        <button type="button" onClick={() => copyValue(RUNNER_BUILD_COMMAND)}>
                          <TerminalSquare size={14} />
                          <span>Build</span>
                          <code>{RUNNER_BUILD_COMMAND}</code>
                        </button>
                        <button type="button" onClick={() => copyValue(RUNNER_DEPLOY_COMMAND)}>
                          <TerminalSquare size={14} />
                          <span>Deploy</span>
                          <code>{RUNNER_DEPLOY_COMMAND}</code>
                        </button>
                      </div>
                      <div className="runner-check-list">
                        {runnerSetupChecks.map((check) => (
                          <div className={check.ok ? "runner-check ok" : "runner-check pending"} key={check.label}>
                            {check.ok ? <Check size={13} /> : <AlertCircle size={13} />}
                            <span>{check.label}</span>
                            <small>{check.detail}</small>
                          </div>
                        ))}
                      </div>
                      <a href={RUNNER_GUIDE_URL} target="_blank" rel="noreferrer">
                        Runner deployment guide <ArrowUpRight size={13} />
                      </a>
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
                    {runnerTxState.status === "submitting" ? "Confirming" : "Send runner tx"}
                  </button>
                </div>
                {!runnerAddressOk && cleanRunnerAddress ? <p>Runner address must be a valid contract address.</p> : null}
                {runnerTxState.status === "submitted" ? <p>Submitted {formatHash(runnerTxState.hash)}</p> : null}
                {runnerTxState.status === "error" ? <p>{runnerTxState.error}</p> : null}
                <div className="runner-history" aria-live="polite">
                  <div className="runner-history-head">
                    <div>
                      <span>Recent runner txs</span>
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
                        placeholder="Paste Precompile Studio runner history JSON"
                        spellCheck={false}
                      />
                      {runnerHistoryMessage ? <p>{runnerHistoryMessage}</p> : null}
                    </div>
                  ) : runnerHistoryMessage ? (
                    <p>{runnerHistoryMessage}</p>
                  ) : null}
                  {runnerRuns.length ? (
                    <div className="runner-history-filter" aria-label="Filter runner transactions by status">
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
                    <p>No {runnerHistoryFilter} runner transactions in this local history.</p>
                  ) : (
                    <p>Submitted runner transactions will appear here.</p>
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

            {wallet.status === "connected" ? (
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
              understandable before you sign it: inputs, encoded calldata, readiness checks, runner details,
              and trace evidence all stay visible in one place.
            </p>
            <p>
              Simple example: choose the HTTP recipe, keep method as GET, and enter a public API URL. The
              studio encodes that request for Ritual&apos;s HTTP precompile. If the HTTP runner contract is
              configured, you can ask your wallet to submit the runner transaction, then watch the local
              runner history for receipt, spcCalls, and callback output.
            </p>
          </section>

          <section className="faq-section">
            <h2>Recipe paths</h2>
            <div className="recipe-guide-list">
              <div>
                <strong>HTTP</strong>
                <p>Encode an HTTP request and submit it through the runner contract when checks pass.</p>
              </div>
              <div>
                <strong>JQ</strong>
                <p>Prepare a synchronous JSON query payload for Ritual&apos;s JQ precompile.</p>
              </div>
              <div>
                <strong>LLM</strong>
                <p>Prepare an LLM inference payload with model, messages, temperature, and history refs.</p>
              </div>
              <div>
                <strong>Agent</strong>
                <p>Prepare Sovereign Agent calldata for CLI-style tasks, tools, callbacks, and output refs.</p>
              </div>
              <div>
                <strong>Scheduler</strong>
                <p>Prepare Scheduler calldata for an approved contract path; direct wallet exports are disabled.</p>
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
              gas and does not send transactions without a wallet confirmation. Local presets, runner addresses,
              and runner history are saved in browser storage, so they are convenient but not a backend account.
            </p>
            <p>
              Do not paste private keys, seed phrases, or real API secrets into recipe fields. For terminal
              runner deployment, use a testnet-only private key and keep it outside the repo.
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
if (!rootElement) throw new Error("Precompile Studio root element is missing.");

const root = window.__precompileStudioRoot ?? createRoot(rootElement);
window.__precompileStudioRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
