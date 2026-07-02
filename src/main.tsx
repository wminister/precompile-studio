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
  Layers3,
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

const recipes: Recipe[] = [
  {
    id: "http",
    name: "HTTP",
    label: "First live recipe",
    icon: Globe2,
    description: "Compose a deterministic external request and prepare the async call path.",
    fields: [
      { key: "method", label: "Method", value: "GET", type: "select", options: ["GET", "POST", "PUT"] },
      { key: "url", label: "URL", value: "https://api.github.com/repos/ritual-net/infernet-ml" },
      { key: "ttl", label: "TTL blocks", value: "160" },
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
  { title: "Encode", body: "Inputs become a reviewable request object first, then ABI calldata in the next build." },
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
  const isRightChain = wallet.chainId === RITUAL.chainId;
  const isReady = rpcState.status === "online" && wallet.status === "connected" && isRightChain;

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
    setWallet({
      status: "connected",
      address: account,
      chainId: Number.parseInt(chainHex, 16),
      balance: formatBalance(balanceHex),
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
      recipe: selectedRecipe.id,
      readiness: {
        rpc: rpcState.status,
        wallet: wallet.status,
        rightChain: isRightChain,
      },
      request: values,
      nextStep: isReady ? "Ready to encode calldata in the contract runner." : "Resolve readiness checks before sending.",
    };
  }, [isReady, isRightChain, rpcState.status, selectedFields, selectedRecipe.id, wallet.status]);

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
      <aside className="rail" aria-label="Primary">
        <a className="brand-mark" href="/" aria-label="Precompile Studio home">
          <Blocks size={28} />
        </a>
        <nav className="rail-nav">
          <button className="rail-button active" aria-label="Composer">
            <Code2 size={19} />
          </button>
          <button className="rail-button" aria-label="Trace">
            <TerminalSquare size={19} />
          </button>
          <button className="rail-button" aria-label="Wallet">
            <Wallet size={19} />
          </button>
          <button className="rail-button" aria-label="Guards">
            <ShieldCheck size={19} />
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Ritual Testnet</p>
            <h1>Precompile Studio</h1>
          </div>
          <div className="topbar-actions">
            <a className="ghost-link" href={RITUAL.docs} target="_blank" rel="noreferrer">
              Docs <ExternalLink size={15} />
            </a>
            <a className="ghost-link" href={RITUAL.faucet} target="_blank" rel="noreferrer">
              Faucet <ExternalLink size={15} />
            </a>
            <button className="primary-action" onClick={connectWallet} disabled={wallet.status === "connecting"}>
              {wallet.status === "connecting" ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
              {wallet.status === "connected" ? formatAddress(wallet.address) : "Connect"}
            </button>
          </div>
        </header>

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
        </section>

        <section className="studio-grid">
          <section className="main-stage" aria-label="Composer">
            <div className="stage-head">
              <div>
                <p className="section-label">Composer</p>
                <h2>Build one async call with guardrails visible.</h2>
              </div>
              <span className={isReady ? "ready-pill ok" : "ready-pill"}>
                {isReady ? <Check size={15} /> : <AlertCircle size={15} />}
                {isReady ? "Ready" : "Resolve checks"}
              </span>
            </div>

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

            <div className="composer-surface">
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
                <button className="primary-action large" disabled={!isReady}>
                  <Send size={16} />
                  Encode call
                </button>
              </div>
            </div>

            <div className="preview-shell">
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
            <section className="inspector-section">
              <div className="inspector-title">
                <CircleDot size={17} />
                <span>Run path</span>
              </div>
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
              <div className="inspector-title">
                <LockKeyhole size={17} />
                <span>Current guardrails</span>
              </div>
              <div className="guard-list">
                <Guard ok={rpcState.status === "online"} label="Ritual RPC responds" />
                <Guard ok={wallet.status === "connected"} label="Wallet connected" />
                <Guard ok={wallet.status === "connected" && isRightChain} label="Wallet on chain 1979" />
                <Guard ok={selectedRecipe.id === "http"} label="HTTP recipe has live fields" />
              </div>
            </section>

            <section className="inspector-section terminal-panel">
              <div className="inspector-title">
                <FlaskConical size={17} />
                <span>Next runner</span>
              </div>
              <p>
                The next build adds a tiny callback contract and ABI encoding so this button can move from preview to
                signed transaction.
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
      {ok ? <Check size={15} /> : <AlertCircle size={15} />}
      <span>{label}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
