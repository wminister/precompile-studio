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
  Upload,
  Wallet,
  Wand2,
  Zap,
} from "lucide-react";
import {
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  isAddress,
  parseEther,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
} from "viem";
import "./styles.css";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
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

type ReceiptStatus = "pending" | "confirmed" | "failed";

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
  status: ReceiptStatus;
  receipt?: RpcReceipt;
  error?: string;
};

type SavedRunner = {
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

type RecipeId = "http" | "llm" | "agent" | "scheduler";

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

const SYSTEM_CONTRACTS = {
  RitualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  AsyncJobTracker: "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5",
  TEEServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  AsyncDelivery: "0x5A16214fF555848411544b005f7Ac063742f39F6",
} as const;

const HTTP_CALL_PRECOMPILE = "0x0000000000000000000000000000000000000801";
const HTTP_ABI_SIGNATURE =
  "address, bytes[], uint256, bytes[], bytes, string, uint8, string[], string[], bytes, uint256, uint8, bool";
const RUNNER_STORAGE_PREFIX = "precompile-studio:runners";
const PRESET_STORAGE_KEY = "precompile-studio:recipe-presets";

const HTTP_METHOD_IDS: Record<string, number> = {
  GET: 1,
  POST: 2,
  PUT: 3,
  DELETE: 4,
  PATCH: 5,
  HEAD: 6,
  OPTIONS: 7,
};

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
    id: "llm",
    name: "LLM",
    label: "Coming next",
    icon: Wand2,
    status: "preview",
    description: "Prompt and callback shell for future LLM precompile work.",
    fields: [
      { key: "model", label: "Model", value: "ritual/default" },
      { key: "prompt", label: "Prompt", value: "Explain the last async job failure in one sentence.", type: "textarea" },
      { key: "ttl", label: "TTL blocks", value: "240" },
    ],
  },
  {
    id: "agent",
    name: "Agent",
    label: "Recipe shell",
    icon: Route,
    status: "preview",
    description: "Multi-step action shell with sender-lock checks visible.",
    fields: [
      { key: "objective", label: "Objective", value: "Fetch, summarize, and commit the result.", type: "textarea" },
      { key: "tools", label: "Allowed tools", value: "http,llm" },
      { key: "ttl", label: "TTL blocks", value: "320" },
    ],
  },
  {
    id: "scheduler",
    name: "Schedule",
    label: "Guardrail pass",
    icon: Activity,
    status: "preview",
    description: "Timing, expiry, and retry shell for scheduled calls.",
    fields: [
      { key: "target", label: "Target contract", value: "0x0000000000000000000000000000000000000000" },
      { key: "start", label: "Start block", value: "latest + 30" },
      { key: "ttl", label: "TTL blocks", value: "120" },
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
];

const timeline = [
  { title: "Readiness", body: "RPC, wallet, chain, and escrow checks." },
  { title: "Encode", body: "13-field ABI payload for 0x0801." },
  { title: "Submit", body: "Connected wallet signs the call." },
  { title: "Trace", body: "Receipt and callbacks stay attached." },
];

function formatAddress(address?: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatHash(hash?: string) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function runnerStorageKey(walletAddress?: string) {
  return `${RUNNER_STORAGE_PREFIX}:${walletAddress?.toLowerCase() ?? "local"}`;
}

function defaultRunnerLabel(address: string) {
  return `HTTP runner ${formatAddress(address)}`;
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
  const [rpcState, setRpcState] = React.useState<RpcState>({ status: "checking" });
  const [wallet, setWallet] = React.useState<WalletState>({ status: "idle" });
  const [activeRecipe, setActiveRecipe] = React.useState<RecipeId>("http");
  const [showAbiDetails, setShowAbiDetails] = React.useState(false);
  const [showRequestPreview, setShowRequestPreview] = React.useState(false);
  const [showRunPath, setShowRunPath] = React.useState(false);
  const [showContracts, setShowContracts] = React.useState(false);
  const [showFunding, setShowFunding] = React.useState(true);
  const [showPresetTransfer, setShowPresetTransfer] = React.useState(false);
  const [presetLabel, setPresetLabel] = React.useState("");
  const [presetImportValue, setPresetImportValue] = React.useState("");
  const [presetTransferMessage, setPresetTransferMessage] = React.useState("");
  const [copiedPresetJson, setCopiedPresetJson] = React.useState(false);
  const [selectedPresetId, setSelectedPresetId] = React.useState("");
  const [recipePresets, setRecipePresets] = React.useState<RecipePreset[]>([]);
  const [depositAmount, setDepositAmount] = React.useState("0.01");
  const [depositLockBlocks, setDepositLockBlocks] = React.useState("100");
  const [depositState, setDepositState] = React.useState<DepositState>({ status: "idle" });
  const [runnerAddress, setRunnerAddress] = React.useState("");
  const [runnerLabel, setRunnerLabel] = React.useState("");
  const [savedRunners, setSavedRunners] = React.useState<SavedRunner[]>([]);
  const [runnerTxState, setRunnerTxState] = React.useState<TransactionState>({ status: "idle" });
  const [runnerRuns, setRunnerRuns] = React.useState<RunnerRun[]>([]);
  const [copiedRunnerCalldata, setCopiedRunnerCalldata] = React.useState(false);
  const [fieldState, setFieldState] = React.useState<Record<RecipeId, ComposerField[]>>(() =>
    recipes.reduce(
      (acc, recipe) => ({ ...acc, [recipe.id]: recipe.fields }),
      {} as Record<RecipeId, ComposerField[]>,
    ),
  );
  const [copied, setCopied] = React.useState(false);
  const [copiedEncoded, setCopiedEncoded] = React.useState(false);

  const selectedRecipe = recipes.find((recipe) => recipe.id === activeRecipe) ?? recipes[0];
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
  const isRightChain = wallet.chainId === RITUAL.chainId;
  const isReady = rpcState.status === "online" && wallet.status === "connected" && isRightChain;
  const isPreviewRecipe = selectedRecipe.status === "preview";
  const isRitualWalletFunded = Number.parseFloat(wallet.ritualWalletBalance ?? "0") > 0;
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
  const canCopyEncoded = selectedRecipe.id === "http" && Boolean(httpDraft.encodedInput);
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
    wallet.status === "connected" &&
    isRightChain &&
    isRitualWalletFunded &&
    runnerTxState.status !== "submitting";
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
        ok: selectedRecipe.id === "http" && httpDraft.errors.length === 0 && Boolean(httpDraft.encodedInput),
        label:
          selectedRecipe.id === "http"
            ? httpDraft.errors[0] ?? "HTTP ABI input encodes"
            : "HTTP is the only live recipe",
        help:
          selectedRecipe.id === "http"
            ? httpDraft.encodedInput
              ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} encoded bytes`
              : "Fix fields before copying ABI input."
            : "Preview recipes are planning shells for now.",
      },
    ];

    return checks;
  }, [
    httpDraft.encodedInput,
    httpDraft.errors,
    isRightChain,
    isRitualWalletFunded,
    rpcState.error,
    rpcState.status,
    selectedRecipe.id,
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
  const blockLabel =
    rpcState.status === "online" && rpcState.block
      ? rpcState.block.toLocaleString()
      : rpcState.status === "offline"
        ? "offline"
        : "pending";
  const contextLabel = selectedRecipe.id === "http" ? "HTTP precompile" : `${selectedRecipe.name} recipe`;
  const contextDetail = selectedRecipe.id === "http" ? "13-field ABI" : "planning shell";
  const stageTitle = selectedRecipe.id === "http" ? "Composer" : `${selectedRecipe.name} preview`;
  const readinessSummary = isPreviewRecipe ? "Preview only" : blockerSummary;
  const readyPillClass = [
    "ready-pill",
    !isPreviewRecipe && !openBlockers.length ? "ok" : "",
    isPreviewRecipe ? "preview" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const encodedActionLabel = copiedEncoded
    ? "Copied input"
    : httpDraft.encodedInput
      ? "Copy ABI input"
      : "Resolve ABI input";

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
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RITUAL.chainHex }],
      });
      await refreshWallet(provider);
    } catch (switchError) {
      const code = typeof switchError === "object" && switchError && "code" in switchError ? switchError.code : undefined;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: RITUAL.chainHex,
              chainName: "Ritual Testnet",
              nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
              rpcUrls: [RITUAL.rpc],
              blockExplorerUrls: [RITUAL.explorer],
            },
          ],
        });
        await refreshWallet(provider);
      } else {
        setWallet((current) => ({
          ...current,
          status: "error",
          error: switchError instanceof Error ? switchError.message : "Could not switch to Ritual.",
        }));
      }
    }
  }, [refreshWallet]);

  React.useEffect(() => {
    refreshRpc();
  }, [refreshRpc]);

  React.useEffect(() => {
    setSavedRunners(parseSavedRunners(window.localStorage.getItem(runnerStorageKey(wallet.address))));
  }, [wallet.address]);

  React.useEffect(() => {
    setRecipePresets(parseRecipePresets(window.localStorage.getItem(PRESET_STORAGE_KEY)));
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
      httpDraft: selectedRecipe.id === "http" ? httpDraft : undefined,
      runner: {
        address: cleanRunnerAddress || "unset",
        recentTransactions: runnerRuns.map((run) => ({
          hash: run.hash,
          status: run.status,
          blockNumber: decodeHexNumber(run.receipt?.blockNumber) ?? "pending",
          spcCalls: describeSpcCalls(run.receipt),
        })),
      },
      nextStep: isReady ? "Ready for a contract runner call." : "Resolve readiness checks before sending.",
    };
  }, [
    cleanRunnerAddress,
    httpDraft,
    isReady,
    isRightChain,
    rpcState.status,
    selectedFields,
    selectedRecipe.id,
    runnerRuns,
    wallet.ritualLockUntil,
    wallet.ritualWalletBalance,
    wallet.status,
  ]);

  const copyPreview = React.useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(requestPreview, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [requestPreview]);

  const copyEncodedInput = React.useCallback(async () => {
    if (!httpDraft.encodedInput) return;
    await navigator.clipboard.writeText(httpDraft.encodedInput);
    setCopiedEncoded(true);
    window.setTimeout(() => setCopiedEncoded(false), 1400);
  }, [httpDraft.encodedInput]);

  const copyRunnerCalldata = React.useCallback(async () => {
    if (!runnerCalldata) return;
    await navigator.clipboard.writeText(runnerCalldata);
    setCopiedRunnerCalldata(true);
    window.setTimeout(() => setCopiedRunnerCalldata(false), 1400);
  }, [runnerCalldata]);

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

  const copyValue = React.useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
  }, []);

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
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          version: 1,
          preset: selectedPreset,
        },
        null,
        2,
      ),
    );
    setCopiedPresetJson(true);
    setPresetTransferMessage("Preset JSON copied.");
    window.setTimeout(() => setCopiedPresetJson(false), 1400);
  }, [selectedPreset]);

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
      setRunnerRuns((current) => [nextRun, ...current.filter((run) => run.hash !== hash)].slice(0, 5));
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

  return (
    <main className="studio-shell">
      <header className="explorer-header">
        <div className="header-inner">
          <a className="brand-lockup" href="/" aria-label="Precompile Studio home">
            <span className="brand-mark">
              <Blocks size={22} />
            </span>
          </a>
          <nav className="header-nav" aria-label="Ritual links">
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
            <div
              className={rpcState.status === "online" ? "network-pill ok" : "network-pill"}
              aria-label={`Ritual block ${blockLabel}`}
            >
              <span aria-hidden="true" />
              <code>{blockLabel}</code>
            </div>
            <button className="primary-action" onClick={connectWallet} disabled={wallet.status === "connecting"}>
              {wallet.status === "connecting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
              {wallet.status === "connected" ? formatAddress(wallet.address) : "Connect"}
            </button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <section className="workbench-head">
          <div>
            <h1>Precompile Studio</h1>
          </div>
          <div className="context-strip" aria-label="Current workbench context">
            <Code2 size={17} />
            <span>{contextLabel}</span>
            <code>0x0801</code>
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
                <button onClick={switchToRitual}>Switch</button>
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
                  <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
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
                        <textarea value={field.value} onChange={(event) => updateField(field.key, event.target.value)} />
                      ) : field.type === "select" ? (
                        <select value={field.value} onChange={(event) => updateField(field.key, event.target.value)}>
                          {field.options?.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={field.value} onChange={(event) => updateField(field.key, event.target.value)} />
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
                {selectedRecipe.id === "http" ? (
                  <button className="primary-action large" onClick={copyEncodedInput} disabled={!canCopyEncoded}>
                    {copiedEncoded ? <Check size={16} /> : <Clipboard size={16} />}
                    {encodedActionLabel}
                  </button>
                ) : null}
              </div>
            </div>

            {selectedRecipe.id === "http" ? (
              <div className="abi-panel utility-panel">
                <div className="section-head">
                  <div>
                    <span>HTTP ABI</span>
                    <strong>{httpDraft.encodedInput ? "Encoded input ready" : "Input needs attention"}</strong>
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
                {showAbiDetails ? <code>{httpDraft.abi}</code> : null}
                <div className="abi-facts">
                  <button type="button" onClick={() => copyValue(httpDraft.callTarget)} title={`Copy target ${httpDraft.callTarget}`}>
                    target {httpDraft.callTarget}
                  </button>
                  <button type="button" onClick={() => copyValue(String(httpDraft.methodId))} title={`Copy method ${httpDraft.methodId}`}>
                    method {httpDraft.methodId}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyValue(Number.isFinite(httpDraft.ttl) ? String(httpDraft.ttl) : "invalid")}
                    title={`Copy ttl ${Number.isFinite(httpDraft.ttl) ? httpDraft.ttl : "invalid"}`}
                  >
                    ttl {Number.isFinite(httpDraft.ttl) ? httpDraft.ttl : "invalid"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyValue(
                        httpDraft.encodedInput
                          ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes`
                          : "not encoded",
                      )
                    }
                    title={
                      httpDraft.encodedInput
                        ? `Copy ${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes`
                        : "Copy not encoded"
                    }
                  >
                    {httpDraft.encodedInput ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes` : "not encoded"}
                  </button>
                </div>
                {httpDraft.errors.length ? (
                  <div className="abi-errors" role="alert" aria-live="polite">
                    {httpDraft.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                ) : null}
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
                    <span>Recent runner txs</span>
                    {runnerRuns.length ? <strong>{runnerRuns.length}</strong> : null}
                  </div>
                  {runnerRuns.length ? (
                    <div className="runner-run-list">
                      {runnerRuns.map((run) => {
                        const blockNumber = decodeHexNumber(run.receipt?.blockNumber);
                        const gasUsed = decodeHexNumber(run.receipt?.gasUsed);
                        return (
                          <article className={`runner-run ${run.status}`} key={run.hash}>
                            <div className="runner-run-main">
                              <span className="runner-run-status">{run.status}</span>
                              <button type="button" onClick={() => copyValue(run.hash)} title={`Copy ${run.hash}`}>
                                {formatHash(run.hash)}
                              </button>
                            </div>
                            <div className="runner-run-meta">
                              <span>{run.method}</span>
                              <span title={run.url}>{run.url}</span>
                              <span>{describeSpcCalls(run.receipt)}</span>
                              {blockNumber ? <span>block {blockNumber.toLocaleString()}</span> : null}
                              {gasUsed ? <span>gas {gasUsed.toLocaleString()}</span> : null}
                            </div>
                            {run.error ? <p>{run.error}</p> : null}
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
                          </article>
                        );
                      })}
                    </div>
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
                        inputMode="decimal"
                        value={depositAmount}
                        onChange={(event) => setDepositAmount(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Lock blocks</span>
                      <input
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
    </main>
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
