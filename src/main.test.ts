import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
} from "viem";
import {
  RITUAL,
  RITUAL_CHAIN_PARAMS,
  JQ_PRECOMPILE,
  SYSTEM_CONTRACTS,
  buildAgentDraft,
  buildHttpDraft,
  buildJqDraft,
  buildLlmDraft,
  buildScheduleDraft,
  createRitualDepositTransaction,
  decodeJqOutput,
  describeHttpPrecompileOutput,
  describeLlmPrecompileOutput,
  describeRunnerCallback,
  ensureRitualChain,
  parseRunnerRuns,
  prepareWalletTransaction,
  receiptStatus,
  recipes,
  requestWalletAccounts,
  runJqCall,
  runnerTraceStages,
  sendWalletTransaction,
  type ComposerField,
  type Eip1193Provider,
  type RecipeId,
  type RpcReceipt,
  type RunnerRun,
} from "./main";
import {
  FIXTURE_CONSUMER_ADDRESS,
  FIXTURE_TX_HASH,
  encodeHttpFixture,
  ritualReceiptFixtures,
} from "./__fixtures__/ritualReceipts";

const TEST_ADDRESS = "0x1111111111111111111111111111111111111111";
const CONSUMER_ADDRESS = FIXTURE_CONSUMER_ADDRESS;
const TX_HASH = FIXTURE_TX_HASH;

function recipeFields(recipeId: RecipeId, overrides: Record<string, string> = {}) {
  const recipe = recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new Error(`Missing ${recipeId} recipe`);
  return recipe.fields.map((field) => ({
    ...field,
    value: overrides[field.key] ?? field.value,
  }));
}

function runWithReceipt(receipt?: RpcReceipt): RunnerRun {
  return {
    hash: TX_HASH,
    runnerAddress: CONSUMER_ADDRESS,
    submittedAt: 1_783_100_000_000,
    method: "GET",
    url: "https://httpbin.org/get",
    status: receiptStatus(receipt),
    receipt,
  };
}

describe("recipe encoders", () => {
  it("encodes the HTTP recipe", () => {
    const draft = buildHttpDraft(recipeFields("http", { executor: TEST_ADDRESS }));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded[0]).toBe(TEST_ADDRESS);
    expect(decoded[5]).toBe("https://httpbin.org/get");
    expect(decoded[6]).toBe(1);
  });

  it("encodes the LLM recipe", () => {
    const draft = buildLlmDraft(recipeFields("llm", { executor: TEST_ADDRESS }));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded[0]).toBe(TEST_ADDRESS);
    expect(decoded[6]).toBe("zai-org/GLM-4.7-FP8");
  });

  it("encodes the JQ recipe", () => {
    const draft = buildJqDraft(recipeFields("jq"));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded).toEqual([".data.price", '{"data":{"price":1979}}', 1]);
  });

  it("encodes the Agent recipe", () => {
    const draft = buildAgentDraft(
      recipeFields("agent", { executor: TEST_ADDRESS, callbackAddress: CONSUMER_ADDRESS }),
    );
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded[0]).toBe(TEST_ADDRESS);
    expect(decoded[6]).toBe(CONSUMER_ADDRESS);
  });

  it("encodes the Scheduler recipe", () => {
    const draft = buildScheduleDraft(recipeFields("scheduler", { payer: CONSUMER_ADDRESS }));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
  });

  it("rejects invalid recipe input before encoding", () => {
    expect(buildHttpDraft(recipeFields("http", { executor: zeroAddress })).encodedInput).toBeUndefined();
    expect(buildJqDraft(recipeFields("jq", { inputData: "{" })).encodedInput).toBeUndefined();
    expect(buildScheduleDraft(recipeFields("scheduler", { payer: zeroAddress })).encodedInput).toBeUndefined();
  });
});

describe("Ritual JQ output decoding", () => {
  const offsetWord = "0".repeat(62) + "20";
  const encodeOutput = (type: string, value: unknown, dynamic = false) => {
    const standard = encodeAbiParameters(parseAbiParameters(type), [value] as never);
    return dynamic ? `0x${offsetWord}${standard.slice(2)}` : standard;
  };

  it.each([
    ["int256", -3n, "-3", false],
    ["uint256", 1979n, "1979", false],
    ["string", "ritual", "ritual", true],
    ["bool", true, true, false],
    ["address", TEST_ADDRESS, TEST_ADDRESS, false],
    ["int256[]", [-3n, 7n], ["-3", "7"], true],
    ["uint256[]", [1979n, 42n], ["1979", "42"], true],
    ["string[]", ["ritual", "jq"], ["ritual", "jq"], true],
    ["bool[]", [true, false], [true, false], true],
    ["address[]", [TEST_ADDRESS], [TEST_ADDRESS], true],
  ])("decodes %s output observed from 0x0803", (type, encodedValue, expected, dynamic) => {
    expect(decodeJqOutput(encodeOutput(String(type), encodedValue, Boolean(dynamic)), String(type)).value).toEqual(expected);
  });

  it("distinguishes valid empty dynamic values from no output", async () => {
    const emptyString = decodeJqOutput(encodeOutput("string", "", true), "string");
    expect(emptyString).toMatchObject({ value: "", isEmpty: true });

    const requester = async <T,>() => "0x" as T;
    await expect(runJqCall("0x12", "uint256", requester)).resolves.toEqual({ status: "empty", raw: "0x" });
  });

  it("rejects malformed or missing dynamic envelopes", () => {
    expect(() => decodeJqOutput("0x12", "uint256")).toThrow("could not be decoded");
    expect(() => decodeJqOutput(encodeOutput("string", "ritual"), "string")).toThrow("dynamic output envelope");
  });

  it("runs JQ as an eth_call against the synchronous precompile", async () => {
    const raw = encodeOutput("uint256", 1979n);
    const requester = vi.fn(async () => raw);
    const result = await runJqCall("0x1234", "uint256", requester as never);
    expect(result.status).toBe("success");
    expect(requester).toHaveBeenCalledWith("eth_call", [
      { to: JQ_PRECOMPILE, data: "0x1234" },
      "latest",
    ]);
  });
});

describe("Ritual HTTP receipt evidence", () => {
  it("decodes HTTP success", () => {
    const evidence = describeHttpPrecompileOutput(encodeHttpFixture(200, '{"ok":true}'));
    expect(evidence?.status).toBe("complete");
    expect(evidence?.result).toMatchObject({ statusCode: 200, bodyText: '{"ok":true}' });
  });

  it("keeps HTTP errors separate from transaction failure", () => {
    const receipt = ritualReceiptFixtures.httpError;
    const run = runWithReceipt(receipt);
    expect(run.status).toBe("confirmed");
    expect(describeRunnerCallback(run).status).toBe("http-error");
    const stages = runnerTraceStages(run);
    expect(stages[stages.length - 1]).toMatchObject({ label: "HTTP response", tone: "wait" });
  });

  it("reports precompile errors from the fifth response field", () => {
    const spcCalls = ritualReceiptFixtures.precompileError.spcCalls as Array<{ output: string }>;
    const evidence = describeHttpPrecompileOutput(spcCalls[0].output);
    expect(evidence?.status).toBe("precompile-error");
    expect(evidence?.result?.errorMessage).toBe("executor timeout");
  });

  it("reports reverted transactions before HTTP evidence", () => {
    const run = runWithReceipt(ritualReceiptFixtures.reverted);
    expect(run.status).toBe("failed");
    expect(describeRunnerCallback(run)).toMatchObject({
      status: "precompile-error",
      detail: "Transaction failed before callback",
    });
  });

  it("handles malformed precompile output without crashing", () => {
    const run = runWithReceipt(ritualReceiptFixtures.malformed);
    expect(describeRunnerCallback(run)).toMatchObject({ status: "missing", detail: "No HTTP output found" });
  });

  it("keeps pending transactions pending", () => {
    const run = runWithReceipt();
    expect(run.status).toBe("pending");
    expect(describeRunnerCallback(run).status).toBe("pending");
    expect(runnerTraceStages(run)[1]).toMatchObject({ tone: "wait", detail: "Waiting for receipt" });
  });

  it("drops malformed persisted history", () => {
    expect(parseRunnerRuns('[{"hash":"not-a-hash"}]')).toEqual([]);
    expect(parseRunnerRuns("not json")).toEqual([]);
  });
});

describe("Ritual LLM receipt evidence", () => {
  const encodeLlmOutput = (hasError = false, errorMessage = "") =>
    encodeAbiParameters(
      parseAbiParameters("bool, bytes, bytes, string, (string,string,string)"),
      [
        hasError,
        stringToHex('{"choices":[{"message":{"content":"Ritual"}}]}'),
        stringToHex('{"model":"zai-org/GLM-4.7-FP8"}'),
        errorMessage,
        ["gcs", "convos/session.jsonl", "GCS_CREDS"],
      ],
    );

  it("decodes completion, metadata, and updated conversation history", () => {
    const evidence = describeLlmPrecompileOutput(encodeLlmOutput());
    expect(evidence).toMatchObject({
      status: "complete",
      result: {
        hasError: false,
        completionText: '{"choices":[{"message":{"content":"Ritual"}}]}',
        metadataText: '{"model":"zai-org/GLM-4.7-FP8"}',
        updatedConvoHistory: ["gcs", "convos/session.jsonl", "GCS_CREDS"],
      },
    });
  });

  it("keeps model errors distinct from transaction failures", () => {
    expect(describeLlmPrecompileOutput(encodeLlmOutput(true, "model unavailable"))).toMatchObject({
      status: "precompile-error",
      result: { hasError: true, errorMessage: "model unavailable" },
    });
  });

  it("rejects malformed LLM output", () => {
    expect(describeLlmPrecompileOutput("0x12")).toBeUndefined();
  });
});

describe("mocked EIP-1193 wallet flows", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests wallet accounts", async () => {
    const request = vi.fn().mockResolvedValue([TEST_ADDRESS]);
    await expect(requestWalletAccounts({ request })).resolves.toEqual([TEST_ADDRESS]);
    expect(request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
  });

  it("switches directly when Ritual is already known", async () => {
    const request = vi.fn().mockResolvedValue(null);
    await expect(ensureRitualChain({ request })).resolves.toBe("switched");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: RITUAL.chainHex }],
    });
  });

  it("adds Ritual when the wallet reports unknown chain", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({ code: 4902, message: "Unknown chain" })
      .mockResolvedValue(null);
    await expect(ensureRitualChain({ request })).resolves.toBe("added");
    expect(request.mock.calls).toEqual([
      [{ method: "wallet_switchEthereumChain", params: [{ chainId: RITUAL.chainHex }] }],
      [{ method: "wallet_addEthereumChain", params: [RITUAL_CHAIN_PARAMS] }],
      [{ method: "wallet_switchEthereumChain", params: [{ chainId: RITUAL.chainHex }] }],
    ]);
  });

  it("builds and sends a RitualWallet deposit", async () => {
    const depositAbi = [
      {
        type: "function",
        name: "deposit",
        stateMutability: "payable",
        inputs: [{ name: "lockDuration", type: "uint256" }],
        outputs: [],
      },
    ] as const;
    const tx = createRitualDepositTransaction(TEST_ADDRESS, 1_000_000_000_000_000n, 5_000n);
    expect(tx.to).toBe(SYSTEM_CONTRACTS.RitualWallet);
    expect(tx.value).toBe("0x38d7ea4c68000");
    expect(decodeFunctionData({ abi: depositAbi, data: tx.data! as `0x${string}` })).toMatchObject({
      functionName: "deposit",
      args: [5_000n],
    });

    const request = vi.fn().mockResolvedValue(TX_HASH);
    await expect(sendWalletTransaction({ request }, tx)).resolves.toBe(TX_HASH);
    expect(request).toHaveBeenCalledWith({ method: "eth_sendTransaction", params: [tx] });
  });

  it("rejects malformed calldata before opening the wallet", async () => {
    const request = vi.fn();
    await expect(
      sendWalletTransaction({ request }, { from: TEST_ADDRESS, to: CONSUMER_ADDRESS, data: "0x123" }),
    ).rejects.toThrow("even-length");
    expect(request).not.toHaveBeenCalled();
  });

  it("explains Rabby's unsupported legacy downgrade", async () => {
    const provider: Eip1193Provider = {
      isRabby: true,
      request: vi.fn().mockRejectedValue({ message: "transaction type not supported" }),
    };
    await expect(
      sendWalletTransaction(provider, { from: TEST_ADDRESS, to: CONSUMER_ADDRESS, data: "0x12" }),
    ).rejects.toThrow("Rabby downgrades Ritual transactions");
  });

  it("prepares an EIP-1559 transaction with the configured gas floor", async () => {
    const responses = new Map([
      ["eth_maxPriorityFeePerGas", "0x3b9aca00"],
      ["eth_gasPrice", "0x77359400"],
      ["eth_getTransactionCount", "0x2"],
      ["eth_estimateGas", "0x186a0"],
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const method = JSON.parse(String(init?.body)).method;
        return { json: async () => ({ result: responses.get(method) }) } as Response;
      }),
    );

    const tx = await prepareWalletTransaction(
      { from: TEST_ADDRESS, to: CONSUMER_ADDRESS, data: "0x12" },
      "0x1e8480",
    );
    expect(tx).toMatchObject({ chainId: RITUAL.chainHex, type: "0x2", nonce: "0x2", gas: "0x1e8480" });
    expect(tx.gasPrice).toBeUndefined();
  });
});
