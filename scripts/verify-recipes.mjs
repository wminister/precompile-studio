import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeAbiParameters, parseAbiParameters, stringToHex, zeroAddress } from "viem";

const root = process.cwd();
const testExecutor = "0x1111111111111111111111111111111111111111";

const httpSignature =
  "address, bytes[], uint256, bytes[], bytes, string, uint8, string[], string[], bytes, uint256, uint8, bool";
const llmSignature =
  "address, bytes[], uint256, bytes[], bytes, string, string, int256, string, bool, int256, string, string, uint256, bool, int256, string, bytes, int256, string, string, bool, int256, bytes, bytes, int256, int256, string, bool, (string,string,string)";
const jqSignature = "string, string, uint8";

const requiredFields = {
  http: ["executor", "method", "ttl", "url", "headers", "body"],
  llm: [
    "executor",
    "ttl",
    "messagesJson",
    "model",
    "temperature",
    "stream",
    "historyPlatform",
    "historyPath",
    "historyKeyRef",
  ],
  jq: ["query", "inputData", "outputType"],
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
  if (!Number.isInteger(ttl) || ttl <= 0) throw new Error("LLM ttl must be a positive whole number");
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("LLM temperature must be between 0 and 2");
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

const encoders = {
  http: encodeHttp,
  llm: encodeLlm,
  jq: encodeJq,
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
