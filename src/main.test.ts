import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
} from "viem";
import {
  RITUAL,
  RITUAL_CHAIN_PARAMS,
  JQ_PRECOMPILE,
  LLM_PRECOMPILE_CONSUMER_ADDRESS,
  SCHEDULED_JQ_CONSUMER_ADDRESS,
  SCHEDULED_JQ_FACTORY_ADDRESS,
  SOVEREIGN_AGENT_FACTORY_ADDRESS,
  SOVEREIGN_AGENT_HARNESS_ADDRESS,
  SOVEREIGN_AGENT_USER_SALT,
  SYSTEM_CONTRACTS,
  buildAgentDraft,
  buildHttpDraft,
  buildJqDraft,
  buildLlmDraft,
  buildScheduleDraft,
  createRitualDepositTransaction,
  createLlmConsumerTransaction,
  createAgentHarnessTransaction,
  createAgentHarnessDeploymentTransaction,
  createSchedulerTransaction,
  createScheduledJqConsumerTransaction,
  decodeSovereignAgentResult,
  decodeJqOutput,
  describeHttpPrecompileOutput,
  describeLlmPrecompileOutput,
  describeRunnerCallback,
  ensureRitualChain,
  parseRunnerRuns,
  prepareWalletTransaction,
  receiptStatus,
  readAgentHarnessStatus,
  readAgentHarnessDiscovery,
  readAgentLifecycle,
  readSchedulerLifecycle,
  readScheduledJqConsumerStatus,
  readScheduledJqConsumerDiscovery,
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
    const draft = buildAgentDraft(recipeFields("agent", { executor: TEST_ADDRESS }));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded[0]).toBe(TEST_ADDRESS);
    expect(decoded[6]).toBe(SOVEREIGN_AGENT_HARNESS_ADDRESS);
    expect(decoded[11]).toBe(6);
    expect(decoded[18]).toBe("zai-org/GLM-4.7-FP8");
  });

  it("rejects unsafe Agent lifecycle input", () => {
    const shortPoll = buildAgentDraft(recipeFields("agent", { executor: TEST_ADDRESS, maxPollBlock: "500" }));
    expect(shortPoll.errors).toContain("Max poll block must be greater than TTL for two-phase delivery.");
    expect(buildAgentDraft(recipeFields("agent", { executor: TEST_ADDRESS, cliType: "4" })).errors).toContain(
      "CLI type must be 0 (Claude Code), 5 (Crush), or 6 (ZeroClaw).",
    );
  });

  it("encodes the Scheduler recipe", () => {
    const draft = buildScheduleDraft(recipeFields("scheduler"));
    expect(draft.errors).toEqual([]);
    expect(draft.encodedInput).toMatch(/^0x/);
    expect(draft.requiredBalance).toBe(10_400_000_000_000_000n);
  });

  it("rejects invalid recipe input before encoding", () => {
    expect(buildHttpDraft(recipeFields("http", { executor: zeroAddress })).encodedInput).toBeUndefined();
    expect(buildJqDraft(recipeFields("jq", { inputData: "{" })).encodedInput).toBeUndefined();
    expect(buildScheduleDraft(recipeFields("scheduler", { inputData: "{" })).encodedInput).toBeUndefined();
  });
});

describe("Scheduled JQ consumer", () => {
  it("creates a consumer through the deployed factory", () => {
    const tx = createScheduledJqConsumerTransaction(TEST_ADDRESS);
    expect(tx).toMatchObject({ from: TEST_ADDRESS, to: SCHEDULED_JQ_FACTORY_ADDRESS });
    expect(tx.data?.slice(0, 10)).toBe(keccak256(stringToHex("createConsumer()")).slice(0, 10));
  });

  it("discovers an existing consumer or its deterministic future address", async () => {
    const predicted = "0x2222222222222222222222222222222222222222";
    const missingResponses = [
      encodeAbiParameters(parseAbiParameters("address"), [zeroAddress]),
      encodeAbiParameters(parseAbiParameters("address"), [predicted]),
    ];
    let missingIndex = 0;
    const missingRequester = async <T,>() => missingResponses[missingIndex++] as T;
    await expect(readScheduledJqConsumerDiscovery(TEST_ADDRESS, missingRequester)).resolves.toEqual({
      status: "missing",
      predictedAddress: predicted,
    });

    const readyRequester = async <T,>() => encodeAbiParameters(parseAbiParameters("address"), [CONSUMER_ADDRESS]) as T;
    await expect(readScheduledJqConsumerDiscovery(TEST_ADDRESS, readyRequester)).resolves.toEqual({
      status: "ready",
      address: CONSUMER_ADDRESS,
    });
  });

  it("uses the atomic payable path when escrow has a shortfall", () => {
    const draft = buildScheduleDraft(recipeFields("scheduler"));
    const tx = createSchedulerTransaction(TEST_ADDRESS, draft, 10_400_000_000_000_000n, CONSUMER_ADDRESS);
    expect(tx.to).toBe(CONSUMER_ADDRESS);
    expect(tx.value).toBe("0x24f2beb1aa0000");
    expect(tx.data?.slice(0, 10)).toBe(
      keccak256(stringToHex("fundAndSchedule(string,string,uint8,uint32,uint32,uint32,uint32,uint256,uint256)")).slice(0, 10),
    );
  });

  it("reads escrow, schedule state, and the latest result", async () => {
    const responses = [
      encodeAbiParameters(parseAbiParameters("address"), [TEST_ADDRESS]),
      encodeAbiParameters(parseAbiParameters("uint256"), [400_000_000_000_000n]),
      encodeAbiParameters(parseAbiParameters("uint256"), [45_500_000n]),
      encodeAbiParameters(parseAbiParameters("uint256"), [0n]),
      encodeAbiParameters(parseAbiParameters("uint256"), [3_146_449n]),
      encodeAbiParameters(parseAbiParameters("uint8"), [2]),
      encodeAbiParameters(parseAbiParameters("uint256"), [1n]),
      encodeAbiParameters(parseAbiParameters("uint256"), [0n]),
      encodeAbiParameters(parseAbiParameters("uint32"), [1]),
      encodeAbiParameters(parseAbiParameters("bytes"), [encodeAbiParameters(parseAbiParameters("uint256"), [1979n])]),
    ];
    let index = 0;
    const requester = async <T,>(method: string) => {
      if (method === "eth_blockNumber") return "0x2b4df20" as T;
      if (method === "eth_getLogs") return [] as T;
      return responses[index++] as T;
    };
    await expect(readScheduledJqConsumerStatus(requester)).resolves.toMatchObject({
      owner: TEST_ADDRESS,
      balance: 400_000_000_000_000n,
      activeScheduleId: 0n,
      lastScheduleId: 3_146_449n,
      scheduleState: 2,
      executionCount: 1n,
      lifecycle: [
        { kind: "scheduled", label: "Schedule created" },
        { kind: "executed", label: "Execution 1 completed" },
        { kind: "completed", label: "Schedule completed" },
      ],
    });
  });

  it("reconciles schedule creation and completion events", async () => {
    const callId = 3_146_449n;
    const addressTopic = `0x${"0".repeat(24)}${SCHEDULED_JQ_CONSUMER_ADDRESS.slice(2).toLowerCase()}`;
    const callIdTopic = encodeAbiParameters(parseAbiParameters("uint256"), [callId]);
    const logs = [
      {
        topics: [
          keccak256(stringToHex("CallScheduled(uint256,address,address,uint32,uint32,uint32,uint32,uint32,uint256,uint256,uint256,bytes)")),
          callIdTopic,
          addressTopic,
          addressTopic,
        ],
        data: encodeAbiParameters(
          parseAbiParameters("uint32,uint32,uint32,uint32,uint32,uint256,uint256,uint256,bytes"),
          [45_371_900, 1, 20, 200_000, 100, 2_000_000_000n, 0n, 0n, "0x1234"],
        ),
        blockNumber: "0x2b4533c",
        transactionHash: TX_HASH,
      },
      {
        topics: [
          keccak256(stringToHex("CallCompleted(uint256,address,address,uint32,uint32,uint32,uint256)")),
          callIdTopic,
          addressTopic,
          addressTopic,
        ],
        data: encodeAbiParameters(parseAbiParameters("uint32,uint32,uint32,uint256"), [45_371_900, 1, 20, 1n]),
        blockNumber: "0x2b45350",
        transactionHash: TX_HASH,
      },
    ];
    const latestBlock = 46_140_866;
    const requester = async <T,>(method: string, params?: unknown[]) => {
      if (method === "eth_blockNumber") return `0x${latestBlock.toString(16)}` as T;
      const filter = params?.[0] as { topics?: string[] } | undefined;
      expect(latestBlock - Number(BigInt((params?.[0] as { fromBlock: string }).fromBlock))).toBeLessThan(100_000);
      expect((params?.[0] as { toBlock: string }).toBlock).toBe(`0x${latestBlock.toString(16)}`);
      return logs.filter((log) => log.topics[0] === filter?.topics?.[0]) as T;
    };
    await expect(readSchedulerLifecycle(callId, requester)).resolves.toMatchObject([
      { kind: "scheduled", label: "Schedule created", tone: "neutral" },
      { kind: "completed", label: "Schedule completed", tone: "ok" },
    ]);
  });
});

describe("Sovereign Agent harness", () => {
  it("creates a deterministic harness through Ritual's deployed factory", () => {
    const tx = createAgentHarnessDeploymentTransaction(TEST_ADDRESS);
    expect(tx).toMatchObject({ from: TEST_ADDRESS, to: SOVEREIGN_AGENT_FACTORY_ADDRESS });
    const decoded = decodeFunctionData({
      abi: [{
        type: "function",
        name: "deployHarness",
        stateMutability: "nonpayable",
        inputs: [{ name: "userSalt", type: "bytes32" }],
        outputs: [{ name: "harness", type: "address" }],
      }] as const,
      data: tx.data as `0x${string}`,
    });
    expect(decoded.args).toEqual([SOVEREIGN_AGENT_USER_SALT]);
  });

  it("discovers the predicted wallet harness from code at its CREATE3 address", async () => {
    const predicted = "0x2222222222222222222222222222222222222222";
    const prediction = encodeAbiParameters(parseAbiParameters("address,bytes32"), [predicted, `0x${"12".repeat(32)}`]);
    const missingRequester = async <T,>(method: string) => (method === "eth_getCode" ? "0x" : prediction) as T;
    await expect(readAgentHarnessDiscovery(TEST_ADDRESS, missingRequester)).resolves.toEqual({
      status: "missing",
      predictedAddress: predicted,
    });

    const readyRequester = async <T,>(method: string) => (method === "eth_getCode" ? "0x6000" : prediction) as T;
    await expect(readAgentHarnessDiscovery(TEST_ADDRESS, readyRequester)).resolves.toEqual({
      status: "ready",
      address: predicted,
    });
  });

  it("creates a payable configureFundAndStart transaction for the deployed harness", () => {
    const draft = buildAgentDraft(
      recipeFields("agent", { executor: TEST_ADDRESS, encryptedSecrets: "0x1234" }),
    );
    const tx = createAgentHarnessTransaction(TEST_ADDRESS, draft, 5n);
    expect(tx.from).toBe(TEST_ADDRESS);
    expect(tx.to).toBe(SOVEREIGN_AGENT_HARNESS_ADDRESS);
    expect(tx.value).toBe("0x5");
    expect(tx.data?.slice(0, 10)).toBe("0xb1906702");
  });

  it("targets the connected wallet's predicted harness in calldata and transaction routing", () => {
    const predicted = "0x2222222222222222222222222222222222222222";
    const draft = buildAgentDraft(
      recipeFields("agent", { executor: TEST_ADDRESS, callbackAddress: predicted }),
      predicted,
    );
    expect(draft.errors).toEqual([]);
    const tx = createAgentHarnessTransaction(TEST_ADDRESS, draft, 5n, 100_000n, predicted);
    expect(tx.to).toBe(predicted);
    const decoded = decodeAbiParameters(parseAbiParameters(draft.abi), draft.encodedInput!);
    expect(decoded[6]).toBe(predicted);
  });

  it("reads ownership, schedule state, and sender lock from live-view calls", async () => {
    const responses = [
      encodeAbiParameters(parseAbiParameters("address"), [TEST_ADDRESS]),
      encodeAbiParameters(parseAbiParameters("bool"), [false]),
      encodeAbiParameters(parseAbiParameters("uint8"), [0]),
      encodeAbiParameters(parseAbiParameters("uint256"), [0n]),
      encodeAbiParameters(parseAbiParameters("uint64"), [0n]),
      encodeAbiParameters(parseAbiParameters("bool"), [false]),
    ];
    let index = 0;
    const requester = async <T,>() => responses[index++] as T;
    await expect(readAgentHarnessStatus(requester)).resolves.toEqual({
      address: SOVEREIGN_AGENT_HARNESS_ADDRESS,
      owner: TEST_ADDRESS,
      configured: false,
      wakeMode: 0,
      activeCallId: "0",
      currentSeriesId: "0",
      senderLocked: false,
    });
  });

  it("decodes the delivered Sovereign Agent result tuple", () => {
    const encoded = encodeAbiParameters(
      parseAbiParameters("bool, string, string, (string,string,string), (string,string,string), (string,string,string)[]"),
      [true, "", "Ritual result", ["", "", ""], ["", "", ""], []],
    );
    expect(decodeSovereignAgentResult(encoded).text).toBe("Ritual result");
  });

  it("reconciles a delivered Agent result from tracker and harness logs", async () => {
    const jobId = `0x${"12".repeat(32)}`;
    const jobAddedTopic = keccak256(stringToHex("JobAdded(address,bytes32,address,uint256,bytes,address,bytes32,uint256,uint256,uint256,uint256)"));
    const resultDeliveredTopic = keccak256(stringToHex("ResultDelivered(bytes32,address,bool)"));
    const sovereignResultTopic = keccak256(stringToHex("SovereignResult(bytes32,bytes)"));
    const innerResult = encodeAbiParameters(
      parseAbiParameters("bool, string, string, (string,string,string), (string,string,string), (string,string,string)[]"),
      [true, "", "Delivered text", ["", "", ""], ["", "", ""], []],
    );
    const jobLog = {
      topics: [jobAddedTopic, `0x${"0".repeat(24)}${TEST_ADDRESS.slice(2)}`, jobId, `0x${"0".repeat(64)}`],
      data: encodeAbiParameters(
        parseAbiParameters("uint256, bytes, address, bytes32, uint256, uint256, uint256, uint256"),
        [100n, "0x", SOVEREIGN_AGENT_HARNESS_ADDRESS as `0x${string}`, `0x${"0".repeat(64)}` as `0x${string}`, 99n, 1n, 500n, 1n] as const,
      ),
      blockNumber: "0x64",
      transactionHash: TX_HASH,
    };
    const trackerResultLog = {
      topics: [resultDeliveredTopic, jobId, `0x${"0".repeat(24)}${SOVEREIGN_AGENT_HARNESS_ADDRESS.slice(2).toLowerCase()}`],
      data: encodeAbiParameters(parseAbiParameters("bool"), [true]),
      blockNumber: "0x66",
      transactionHash: TX_HASH,
    };
    const harnessResultLog = {
      topics: [sovereignResultTopic, jobId],
      data: encodeAbiParameters(parseAbiParameters("bytes"), [innerResult]),
      blockNumber: "0x66",
      transactionHash: TX_HASH,
    };
    const requester = async <T,>(method: string, params?: unknown[]) => {
      if (method === "eth_blockNumber") return "0x2c00000" as T;
      expect(method).toBe("eth_getLogs");
      const filter = params?.[0] as { address: string; fromBlock: string; toBlock: string; topics: Array<string | null> };
      expect(Number(BigInt(filter.toBlock)) - Number(BigInt(filter.fromBlock))).toBeLessThan(100_000);
      if (filter.topics[0] === jobAddedTopic) return [jobLog] as T;
      if (filter.topics[0] === resultDeliveredTopic) return [trackerResultLog] as T;
      if (filter.topics[0] === sovereignResultTopic) return [harnessResultLog] as T;
      return [] as T;
    };
    await expect(readAgentLifecycle(true, requester)).resolves.toMatchObject({
      status: "settled",
      jobId,
      result: { success: true, text: "Delivered text" },
    });
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
  const encodeLlmOutput = (hasError = false, errorMessage = "") => {
    const messageData = encodeAbiParameters(
      parseAbiParameters("string, string, string, uint256, bytes[]"),
      ["assistant", "Ritual", "", 0n, []],
    );
    const choiceData = encodeAbiParameters(
      parseAbiParameters("uint256, string, bytes"),
      [0n, "stop", messageData],
    );
    const usageData = encodeAbiParameters(
      parseAbiParameters("uint256, uint256, uint256"),
      [12n, 4n, 16n],
    );
    const completionData = encodeAbiParameters(
      parseAbiParameters("string, string, uint256, string, string, string, uint256, bytes[], bytes"),
      ["chatcmpl-1", "chat.completion", 1n, "zai-org/GLM-4.7-FP8", "", "default", 1n, [choiceData], usageData],
    );
    const metadataData = encodeAbiParameters(
      parseAbiParameters("string, uint256, string, uint256, uint256"),
      ["zai-org/GLM-4.7-FP8", 355_000_000_000n, "fp8", 1_000_000n, 131_072n],
    );
    return encodeAbiParameters(
      parseAbiParameters("bool, bytes, bytes, string, (string,string,string)"),
      [
        hasError,
        hasError ? "0x" : completionData,
        hasError ? "0x" : metadataData,
        errorMessage,
        ["gcs", "convos/session.jsonl", "GCS_CREDS"],
      ],
    );
  };

  it("decodes completion, metadata, and updated conversation history", () => {
    const evidence = describeLlmPrecompileOutput(encodeLlmOutput());
    expect(evidence).toMatchObject({
      status: "complete",
      result: {
        hasError: false,
        completionText: "Ritual",
        completion: {
          model: "zai-org/GLM-4.7-FP8",
          content: "Ritual",
          finishReason: "stop",
          totalTokens: "16",
        },
        metadata: {
          model: "zai-org/GLM-4.7-FP8",
          datatype: "fp8",
          maxSequenceLength: "131072",
        },
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

  it("targets the deployed LLM consumer with encoded precompile input", () => {
    const draft = buildLlmDraft(recipeFields("llm"));
    expect(draft.errors).toEqual([]);
    const tx = createLlmConsumerTransaction(TEST_ADDRESS, draft.encodedInput!);
    expect(tx.to).toBe(LLM_PRECOMPILE_CONSUMER_ADDRESS);
    expect(
      decodeFunctionData({
        abi: [
          {
            type: "function",
            name: "callLlmRaw",
            stateMutability: "nonpayable",
            inputs: [{ name: "llmInput", type: "bytes" }],
            outputs: [],
          },
        ] as const,
        data: tx.data as `0x${string}`,
      }),
    ).toMatchObject({ functionName: "callLlmRaw", args: [draft.encodedInput] });
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

  it("caps an inflated Ritual gas estimate at a verified workflow ceiling", async () => {
    const responses = new Map([
      ["eth_maxPriorityFeePerGas", "0x3b9aca00"],
      ["eth_gasPrice", "0x3b9aca07"],
      ["eth_getTransactionCount", "0x2"],
      ["eth_estimateGas", "0xb773f92"],
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
      "0xf4240",
      "0xf4240",
    );
    expect(tx.gas).toBe("0xf4240");
  });
});
