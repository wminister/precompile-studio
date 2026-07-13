import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeAbiParameters, encodeFunctionData, parseAbiParameters, stringToHex, zeroAddress } from "viem";

const root = process.cwd();
const testExecutor = "0x1111111111111111111111111111111111111111";
const sovereignAgentHarness = "0x8067904eA53D7D0418AC0B5F87d2b4c7a59dE2Fe";

const httpSignature =
  "address, bytes[], uint256, bytes[], bytes, string, uint8, string[], string[], bytes, uint256, uint8, bool";
const llmSignature =
  "address, bytes[], uint256, bytes[], bytes, string, string, int256, string, bool, int256, string, string, uint256, bool, int256, string, bytes, int256, string, string, bool, int256, bytes, bytes, int256, int256, string, bool, (string,string,string)";
const jqSignature = "string, string, uint8";
const agentSignature =
  "address, uint256, bytes, uint64, uint64, string, address, bytes4, uint256, uint256, uint256, uint16, string, bytes, (string,string,string), (string,string,string), (string,string,string)[], (string,string,string), string, string[], uint16, uint32, string";

const requiredFields = {
  http: ["executor", "method", "ttl", "url", "headers", "body"],
  llm: [
    "executor",
    "ttl",
    "messagesJson",
    "model",
    "maxCompletionTokens",
    "temperature",
    "stream",
    "historyPlatform",
    "historyPath",
    "historyKeyRef",
  ],
  jq: ["query", "inputData", "outputType"],
  agent: [
    "executor",
    "ttl",
    "pollInterval",
    "maxPollBlock",
    "taskIdMarker",
    "callbackAddress",
    "callbackSelector",
    "gasLimit",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "cliType",
    "prompt",
    "encryptedSecrets",
    "historyPlatform",
    "historyPath",
    "historyKeyRef",
    "outputPlatform",
    "outputPath",
    "outputKeyRef",
    "skillsJson",
    "systemPromptPlatform",
    "systemPromptPath",
    "systemPromptKeyRef",
    "model",
    "tools",
    "maxTurns",
    "maxTokens",
    "rpcUrls",
  ],
  scheduler: [
    "callbackData",
    "gas",
    "startBlock",
    "numCalls",
    "frequency",
    "ttl",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "value",
    "payer",
  ],
};

const httpMethodIds = {
  GET: 1,
  POST: 2,
  PUT: 3,
  DELETE: 4,
  PATCH: 5,
  HEAD: 6,
  OPTIONS: 7,
};

const jqOutputTypes = {
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

const exampleFiles = [
  "examples/http-preset.json",
  "examples/llm-preset.json",
  "examples/jq-preset.json",
  "examples/agent-preset.json",
  "examples/scheduler-preset.json",
];

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
];

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function presetFromFile(path) {
  const parsed = readJson(path);
  if (parsed.version !== 1) throw new Error(`${path}: expected version 1`);
  if (!parsed.preset || typeof parsed.preset !== "object") throw new Error(`${path}: missing preset object`);
  return parsed.preset;
}

function fieldsByKey(preset) {
  if (!Array.isArray(preset.fields)) throw new Error(`${preset.id}: fields must be an array`);
  return Object.fromEntries(
    preset.fields.map((field) => {
      if (typeof field?.key !== "string" || typeof field?.value !== "string") {
        throw new Error(`${preset.id}: each field needs string key and value`);
      }
      return [field.key, field.value];
    }),
  );
}

function assertRequiredFields(preset, fields) {
  const required = requiredFields[preset.recipeId];
  if (!required) throw new Error(`${preset.id}: unsupported recipeId ${preset.recipeId}`);
  const missing = required.filter((key) => !(key in fields));
  if (missing.length) throw new Error(`${preset.id}: missing ${missing.join(", ")}`);
}

function parseHeaders(value) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keys = [];
  const values = [];
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Invalid header line: ${line}`);
    keys.push(line.slice(0, separator).trim());
    values.push(line.slice(separator + 1).trim());
  }
  return { keys, values };
}

function encodeHttp(fields) {
  const executor = fields.executor === zeroAddress ? testExecutor : fields.executor;
  const ttl = Number.parseInt(fields.ttl, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error("HTTP ttl must be positive");
  if (!fields.url.startsWith("https://")) throw new Error("HTTP url must use https://");
  const headers = parseHeaders(fields.headers);
  return encodeAbiParameters(parseAbiParameters(httpSignature), [
    executor,
    [],
    BigInt(ttl),
    [],
    "0x",
    fields.url,
    httpMethodIds[fields.method] ?? 1,
    headers.keys,
    headers.values,
    fields.body.trim() ? stringToHex(fields.body) : "0x",
    0n,
    0,
    false,
  ]);
}

function encodeLlm(fields) {
  const executor = fields.executor === zeroAddress ? testExecutor : fields.executor;
  const messages = JSON.parse(fields.messagesJson);
  if (!Array.isArray(messages) || !messages.length) throw new Error("LLM messagesJson must be a non-empty array");
  const ttl = Number(fields.ttl);
  const temperature = Number(fields.temperature);
  const maxCompletionTokens = Number(fields.maxCompletionTokens);
  if (!Number.isInteger(ttl) || ttl <= 0) throw new Error("LLM ttl must be a positive whole number");
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("LLM temperature must be between 0 and 2");
  }
  if (!Number.isInteger(maxCompletionTokens) || maxCompletionTokens < 1) {
    throw new Error("LLM maxCompletionTokens must be a positive whole number");
  }
  return encodeAbiParameters(parseAbiParameters(llmSignature), [
    executor,
    [],
    BigInt(ttl),
    [],
    "0x",
    fields.messagesJson,
    fields.model,
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
    fields.stream === "true",
    BigInt(Math.round(temperature * 1000)),
    "0x",
    "0x",
    -1n,
    1000n,
    "",
    false,
    [fields.historyPlatform, fields.historyPath, fields.historyKeyRef],
  ]);
}

function encodeJq(fields) {
  JSON.parse(fields.inputData);
  const outputType = jqOutputTypes[fields.outputType];
  if (outputType === undefined) throw new Error(`Unsupported JQ output type ${fields.outputType}`);
  return encodeAbiParameters(parseAbiParameters(jqSignature), [fields.query, fields.inputData, outputType]);
}

function parseStringList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUint(value, label, { min = 0n, max } = {}) {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number`);
  const parsed = BigInt(value.trim());
  if (parsed < min) throw new Error(`${label} must be >= ${min}`);
  if (max !== undefined && parsed > max) throw new Error(`${label} must be <= ${max}`);
  return parsed;
}

function parseHexBytes(value, label, byteLength) {
  const normalized = value.trim() || "0x";
  if (!/^0x[a-fA-F0-9]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`${label} must be 0x-prefixed hex bytes`);
  }
  if (byteLength !== undefined && (normalized.length - 2) / 2 !== byteLength) {
    throw new Error(`${label} must be ${byteLength} bytes`);
  }
  return normalized;
}

function hasZeroExecutionIndexPlaceholder(calldata) {
  const hex = calldata.slice(2);
  if (hex.length < 72) return false;
  return /^0{64}$/i.test(hex.slice(8, 72));
}

function storageRef(fields, prefix) {
  return [fields[`${prefix}Platform`], fields[`${prefix}Path`], fields[`${prefix}KeyRef`]];
}

function parseStorageRefList(value) {
  const parsed = JSON.parse(value || "[]");
  if (!Array.isArray(parsed)) throw new Error("skillsJson must be an array");
  return parsed.map((item, index) => {
    if (Array.isArray(item) && item.length === 3 && item.every((part) => typeof part === "string")) {
      return item;
    }
    if (
      item &&
      typeof item === "object" &&
      typeof item.platform === "string" &&
      typeof item.path === "string" &&
      typeof item.keyRef === "string"
    ) {
      return [item.platform, item.path, item.keyRef];
    }
    throw new Error(`skillsJson item ${index + 1} must be a storage ref`);
  });
}

function encodeAgent(fields) {
  const executor = fields.executor === zeroAddress ? testExecutor : fields.executor;
  const callbackAddress = fields.callbackAddress === zeroAddress ? sovereignAgentHarness : fields.callbackAddress;
  const prompt = fields.prompt.trim();
  const tools = parseStringList(fields.tools);
  const ttl = parseUint(fields.ttl, "Agent ttl", { min: 1n });
  const maxPollBlock = parseUint(fields.maxPollBlock, "Agent maxPollBlock", { min: 1n, max: 70_000n });
  const cliType = parseUint(fields.cliType, "Agent cliType", { max: 65535n });
  if (!prompt) throw new Error("Agent prompt is required");
  if (callbackAddress.toLowerCase() !== sovereignAgentHarness.toLowerCase()) {
    throw new Error("Agent callbackAddress must be the deployed Sovereign Agent harness");
  }
  if (maxPollBlock <= ttl) throw new Error("Agent maxPollBlock must be greater than ttl");
  if (![0n, 5n, 6n].includes(cliType)) throw new Error("Agent cliType must be 0, 5, or 6");
  return encodeAbiParameters(parseAbiParameters(agentSignature), [
    executor,
    ttl,
    "0x",
    parseUint(fields.pollInterval, "Agent pollInterval", { min: 1n }),
    maxPollBlock,
    fields.taskIdMarker,
    callbackAddress,
    parseHexBytes(fields.callbackSelector, "Agent callbackSelector", 4),
    parseUint(fields.gasLimit, "Agent gasLimit", { min: 1n }),
    parseUint(fields.maxFeePerGas, "Agent maxFeePerGas"),
    parseUint(fields.maxPriorityFeePerGas, "Agent maxPriorityFeePerGas"),
    Number(cliType),
    prompt,
    parseHexBytes(fields.encryptedSecrets, "Agent encryptedSecrets"),
    storageRef(fields, "history"),
    storageRef(fields, "output"),
    parseStorageRefList(fields.skillsJson),
    storageRef(fields, "systemPrompt"),
    fields.model,
    tools,
    Number(parseUint(fields.maxTurns, "Agent maxTurns", { min: 1n, max: 65535n })),
    Number(parseUint(fields.maxTokens, "Agent maxTokens", { min: 1n, max: 4294967295n })),
    fields.rpcUrls,
  ]);
}

function encodeScheduler(fields) {
  const payer = fields.payer === zeroAddress ? testExecutor : fields.payer;
  const callbackData = parseHexBytes(fields.callbackData, "Scheduler callbackData");
  if ((callbackData.length - 2) / 2 < 36) {
    throw new Error("Scheduler callbackData must include selector and executionIndex placeholder");
  }
  if (!hasZeroExecutionIndexPlaceholder(callbackData)) {
    throw new Error("Scheduler callbackData bytes 4-35 must be a zero executionIndex placeholder");
  }
  return encodeFunctionData({
    abi: schedulerAbi,
    functionName: "schedule",
    args: [
      callbackData,
      Number(parseUint(fields.gas, "Scheduler gas", { min: 1n, max: 4294967295n })),
      Number(parseUint(fields.startBlock, "Scheduler startBlock", { min: 1n, max: 4294967295n })),
      Number(parseUint(fields.numCalls, "Scheduler numCalls", { min: 1n, max: 4294967295n })),
      Number(parseUint(fields.frequency, "Scheduler frequency", { min: 1n, max: 4294967295n })),
      Number(parseUint(fields.ttl, "Scheduler ttl", { min: 1n, max: 500n })),
      parseUint(fields.maxFeePerGas, "Scheduler maxFeePerGas"),
      parseUint(fields.maxPriorityFeePerGas, "Scheduler maxPriorityFeePerGas"),
      parseUint(fields.value, "Scheduler value"),
      payer,
    ],
  });
}

const encoders = {
  http: encodeHttp,
  llm: encodeLlm,
  jq: encodeJq,
  agent: encodeAgent,
  scheduler: encodeScheduler,
};

const results = exampleFiles.map((file) => {
  const preset = presetFromFile(file);
  const fields = fieldsByKey(preset);
  assertRequiredFields(preset, fields);
  const encoded = encoders[preset.recipeId](fields);
  return {
    file,
    recipeId: preset.recipeId,
    bytes: (encoded.length - 2) / 2,
  };
});

console.log(JSON.stringify({ ok: true, recipes: results }, null, 2));
