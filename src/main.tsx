import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Blocks,
  Check,
  ChevronRight,
  CircleDot,
  Clipboard,
  Code2,
  ExternalLink,
  FlaskConical,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  Play,
  RadioTower,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  TerminalSquare,
  Wallet,
  Wand2,
  Zap,
} from "lucide-react";
import {
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  isAddress,
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

type RecipeId = "http" | "llm" | "agent" | "scheduler";

type Recipe = {
  id: RecipeId;
  name: string;
  label: string;
  icon: React.ElementType;
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

const recipes: Recipe[] = [
  {
    id: "http",
    name: "HTTP",
    label: "First live recipe",
    icon: Globe2,
    description: "Compose the 13-field HTTP precompile input for address 0x0801.",
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
    description: "Draft prompts, model options, and callback expectations for LLM precompile work.",
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
    description: "Plan a multi-step agent action while making sender-lock risk visible.",
    fields: [
      { key: "objective", label: "Objective", value: "Fetch, summarize, and commit the result.", type: "textarea" },
      { key: "tools", label: "Allowed tools", value: "http,llm" },
      { key: "ttl", label: "TTL blocks", value: "320" },
    ],
  },
  {
    id: "scheduler",
    name: "Scheduler",
    label: "Guardrail pass",
    icon: Activity,
    description: "Prepare scheduled calls with explicit timing, expiry, and retry windows.",
    fields: [
      { key: "target", label: "Target contract", value: "0x0000000000000000000000000000000000000000" },
      { key: "start", label: "Start block", value: "latest + 30" },
      { key: "ttl", label: "TTL blocks", value: "120" },
    ],
  },
];

const timeline = [
  { title: "Readiness", body: "Chain, balance, and sender-lock checks happen before any call leaves the app." },
  { title: "Encode", body: "Inputs become Ritual's 13-field HTTP ABI payload for the 0x0801 precompile." },
  { title: "Submit", body: "The connected wallet signs. Users pay their own Ritual testnet gas and precompile fees." },
  { title: "Trace", body: "Receipt, spcCalls, callback, and explorer evidence stay attached to the run." },
];

function formatAddress(address?: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  const [fieldState, setFieldState] = React.useState<Record<RecipeId, ComposerField[]>>(() =>
    recipes.reduce(
      (acc, recipe) => ({ ...acc, [recipe.id]: recipe.fields }),
      {} as Record<RecipeId, ComposerField[]>,
    ),
  );
  const [copied, setCopied] = React.useState(false);

  const selectedRecipe = recipes.find((recipe) => recipe.id === activeRecipe) ?? recipes[0];
  const selectedFields = fieldState[selectedRecipe.id];
  const httpDraft = React.useMemo(() => buildHttpDraft(fieldState.http), [fieldState.http]);
  const isRightChain = wallet.chainId === RITUAL.chainId;
  const isReady = rpcState.status === "online" && wallet.status === "connected" && isRightChain;
  const isRitualWalletFunded = Number.parseFloat(wallet.ritualWalletBalance ?? "0") > 0;

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
      nextStep: isReady ? "Ready for a contract runner call." : "Resolve readiness checks before sending.",
    };
  }, [
    httpDraft,
    isReady,
    isRightChain,
    rpcState.status,
    selectedFields,
    selectedRecipe.id,
    wallet.ritualLockUntil,
    wallet.ritualWalletBalance,
    wallet.status,
  ]);

  const copyPreview = React.useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(requestPreview, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [requestPreview]);

  const updateField = (key: string, value: string) => {
    setFieldState((current) => ({
      ...current,
      [selectedRecipe.id]: current[selectedRecipe.id].map((field) =>
        field.key === key ? { ...field, value } : field,
      ),
    }));
  };

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
            <button className="primary-action" onClick={connectWallet} disabled={wallet.status === "connecting"}>
              {wallet.status === "connecting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
              {wallet.status === "connected" ? formatAddress(wallet.address) : "Connect"}
            </button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <section className="hero-panel">
          <h1>Precompile Studio</h1>
          <p className="hero-copy">
            Compose, inspect, and prepare Ritual precompile calls with wallet and chain checks visible before submit.
          </p>
          <div className="search-shell">
            <Code2 size={18} />
            <span>HTTP precompile · 0x0801 · ABI payload preview</span>
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
                <p className="section-label">Composer</p>
                <h2>Build one async call</h2>
              </div>
              <span className={isReady ? "ready-pill ok" : "ready-pill"}>
                {isReady ? <Check size={15} /> : <AlertCircle size={15} />}
                {isReady ? "Ready" : "Resolve checks"}
              </span>
            </div>

            <div className="composer-surface explorer-panel">
              <div className="recipe-tabs" role="tablist" aria-label="Precompile recipes">
                {recipes.map((recipe) => {
                  const Icon = recipe.icon;
                  return (
                    <button
                      key={recipe.id}
                      className={recipe.id === activeRecipe ? "recipe-tab active" : "recipe-tab"}
                      onClick={() => setActiveRecipe(recipe.id)}
                      role="tab"
                      aria-selected={recipe.id === activeRecipe}
                    >
                      <Icon size={17} />
                      <span>{recipe.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="composer-intro">
                <span>{selectedRecipe.label}</span>
                <p>{selectedRecipe.description}</p>
              </div>

              <div className="field-grid">
                {selectedFields.map((field) => (
                  <label className={field.type === "textarea" ? "field wide" : "field"} key={field.key}>
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
                ))}
              </div>

              <div className="composer-actions">
                <button className="secondary-action" onClick={copyPreview}>
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? "Copied" : "Copy request"}
                </button>
                <button className="primary-action large" disabled={!isReady || !httpDraft.encodedInput}>
                  <Send size={16} />
                  Encode call
                </button>
              </div>
            </div>

            {selectedRecipe.id === "http" ? (
              <div className="abi-panel explorer-panel">
                <div>
                  <span>HTTP ABI</span>
                  <strong>{httpDraft.encodedInput ? "Encoded input ready" : "Input needs attention"}</strong>
                </div>
                <code>{httpDraft.abi}</code>
                <div className="abi-facts">
                  <span>target {httpDraft.callTarget}</span>
                  <span>method {httpDraft.methodId}</span>
                  <span>ttl {Number.isFinite(httpDraft.ttl) ? httpDraft.ttl : "invalid"}</span>
                  <span>{httpDraft.encodedInput ? `${Math.floor((httpDraft.encodedInput.length - 2) / 2)} bytes` : "not encoded"}</span>
                </div>
                {httpDraft.errors.length ? (
                  <div className="abi-errors">
                    {httpDraft.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="preview-shell explorer-panel">
              <div className="preview-header">
                <span>Request preview</span>
                <a href={RITUAL.explorer} target="_blank" rel="noreferrer">
                  Explorer <ArrowUpRight size={14} />
                </a>
              </div>
              <pre>{JSON.stringify(requestPreview, null, 2)}</pre>
            </div>
          </section>

          <aside className="inspector" aria-label="Inspector">
            <div className="inspector-head">
              <div>
                <CircleDot size={17} />
                <span>Run path</span>
              </div>
              <strong>{isReady ? "Ready" : "Checks pending"}</strong>
            </div>

            <section className="inspector-section run-path">
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
            </section>

            <section className="inspector-section">
              <div className="inspector-title compact-title">
                <LockKeyhole size={17} />
                <span>Current guardrails</span>
              </div>
              <div className="guard-list">
                <Guard ok={rpcState.status === "online"} label="Ritual RPC responds" />
                <Guard ok={wallet.status === "connected"} label="Wallet connected" />
                <Guard ok={wallet.status === "connected" && isRightChain} label="Wallet on chain 1979" />
                <Guard ok={wallet.status === "connected" && isRitualWalletFunded} label="RitualWallet funded" />
                <Guard ok={selectedRecipe.id === "http"} label="HTTP recipe has live fields" />
                <Guard ok={selectedRecipe.id !== "http" || httpDraft.errors.length === 0} label="HTTP ABI input encodes" />
              </div>
            </section>

            <section className="inspector-section">
              <div className="inspector-title compact-title">
                <KeyRound size={17} />
                <span>System contracts</span>
              </div>
              <div className="contract-list">
                {Object.entries(SYSTEM_CONTRACTS).map(([name, address]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <code>{formatAddress(address)}</code>
                  </div>
                ))}
              </div>
            </section>

            <section className="inspector-section terminal-panel">
              <div className="inspector-title compact-title">
                <FlaskConical size={17} />
                <span>Runner status</span>
              </div>
              <p>
                The composer now produces the HTTP precompile input. The next build adds a tiny contract runner so the
                encoded input can be sent as a signed transaction.
              </p>
              <button className="ghost-link full">
                Open runner spec <ChevronRight size={15} />
              </button>
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
        <strong>{value}</strong>
      </div>
      {action ? <div className="status-action">{action}</div> : null}
    </div>
  );
}

function Guard({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={ok ? "guard ok" : "guard"}>
      {ok ? <Check size={13} /> : <AlertCircle size={13} />}
      <span>{label}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
