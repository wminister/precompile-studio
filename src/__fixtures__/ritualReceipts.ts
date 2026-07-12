import { encodeAbiParameters, parseAbiParameters, stringToHex } from "viem";
import type { RpcReceipt } from "../main";

export const FIXTURE_TX_HASH = `0x${"ab".repeat(32)}`;
export const FIXTURE_CONSUMER_ADDRESS = "0x30a2132b7f47A30E2D55A191F6723161C232263C";
export const FIXTURE_HTTP_PRECOMPILE = "0x0000000000000000000000000000000000000801";

export function encodeHttpFixture(statusCode: number, body: string, errorMessage = "") {
  return encodeAbiParameters(
    parseAbiParameters("uint16, string[], string[], bytes, string"),
    [statusCode, ["content-type"], ["application/json"], stringToHex(body), errorMessage],
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
  pending: null,
} as const;
