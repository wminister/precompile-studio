import { encodeAbiParameters, parseAbiParameters, stringToHex } from "viem";
import type { RpcReceipt } from "../main";

export const FIXTURE_TX_HASH = `0x${"ab".repeat(32)}`;
export const FIXTURE_LLM_TX_HASH = `0x${"cd".repeat(32)}`;
export const FIXTURE_CONSUMER_ADDRESS = "0x30a2132b7f47A30E2D55A191F6723161C232263C";
export const FIXTURE_HTTP_PRECOMPILE = "0x0000000000000000000000000000000000000801";
export const FIXTURE_LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802";

export function encodeHttpFixture(statusCode: number, body: string, errorMessage = "") {
  return encodeAbiParameters(
    parseAbiParameters("uint16, string[], string[], bytes, string"),
    [statusCode, ["content-type"], ["application/json"], stringToHex(body), errorMessage],
  );
}

export function encodeLlmFixture(content = "Ritual LLM online.") {
  const messageData = encodeAbiParameters(
    parseAbiParameters("string, string, string, uint256, bytes[]"),
    ["assistant", content, "", 0n, []],
  );
  const choiceData = encodeAbiParameters(
    parseAbiParameters("uint256, string, bytes"),
    [0n, "stop", messageData],
  );
  const usageData = encodeAbiParameters(
    parseAbiParameters("uint256, uint256, uint256"),
    [12n, 5n, 17n],
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
    [false, completionData, metadataData, "", ["", "", ""]],
  );
}

function receipt(output: string, status = "0x1"): RpcReceipt {
  return {
    transactionHash: FIXTURE_TX_HASH,
    blockNumber: "0x2a10000",
    status,
    gasUsed: "0x3048f",
    logs: [],
    spcCalls: [{ address: FIXTURE_HTTP_PRECOMPILE, output }],
  };
}

export const ritualReceiptFixtures = {
  success: receipt(encodeHttpFixture(200, '{"ok":true}')),
  httpError: receipt(encodeHttpFixture(404, '{"message":"Not Found"}')),
  precompileError: receipt(encodeHttpFixture(0, "", "executor timeout")),
  reverted: {
    transactionHash: FIXTURE_TX_HASH,
    blockNumber: "0x2a10000",
    status: "0x0",
    gasUsed: "0x186a0",
    logs: [],
  } satisfies RpcReceipt,
  malformed: receipt("0x1234"),
  llmSuccess: {
    transactionHash: FIXTURE_LLM_TX_HASH,
    blockNumber: "0x2a10001",
    status: "0x1",
    gasUsed: "0x29f63",
    logs: [],
    spcCalls: [{ address: FIXTURE_LLM_PRECOMPILE, output: encodeLlmFixture() }],
  } satisfies RpcReceipt,
  pending: null,
} as const;
