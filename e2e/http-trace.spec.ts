import { expect, test } from "@playwright/test";
import { encodeAbiParameters, parseAbiParameters, toFunctionSelector } from "viem";
import {
  FIXTURE_CONSUMER_ADDRESS,
  FIXTURE_LLM_TX_HASH,
  FIXTURE_TX_HASH,
  ritualReceiptFixtures,
} from "../src/__fixtures__/ritualReceipts";

const RPC_URL = "https://rpc.ritualfoundation.org";
const TX_HASH = FIXTURE_TX_HASH;
const CONSUMER = FIXTURE_CONSUMER_ADDRESS;
const TEST_ACCOUNT = "0x1111111111111111111111111111111111111111";
const TEST_EXECUTOR = "0x2222222222222222222222222222222222222222";
const SCHEDULER_CONSUMER = "0x7243c1A2cA1Ea555416951480B147c27b17eA668";
const PREDICTED_SCHEDULER_CONSUMER = "0x3333333333333333333333333333333333333333";
const PREDICTED_AGENT_HARNESS = "0x4444444444444444444444444444444444444444";
const TEST_PUBLIC_KEY = `0x04${"33".repeat(64)}` as `0x${string}`;
const ZERO_HASH = `0x${"0".repeat(64)}` as `0x${string}`;

test.beforeEach(async ({ page }, testInfo) => {
  const firstTimeSchedulerWallet = testInfo.title.includes("creates its Scheduled JQ consumer");
  let factoryLookupCount = 0;
  await page.addInitScript(({ llmHash }) => {
    const account = "0x1111111111111111111111111111111111111111";
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
        if (method === "eth_chainId") return "0x7bb";
        if (method === "eth_getBalance") return "0xde0b6b3a7640000";
        if (method === "eth_sendTransaction") return llmHash;
        return null;
      },
    };
    Object.defineProperty(window, "ethereum", { value: provider, configurable: true });
  }, { llmHash: FIXTURE_LLM_TX_HASH });

  await page.route(RPC_URL, async (route) => {
    const payload = route.request().postDataJSON() as { id: number; method: string; params?: unknown[] };
    let result: unknown = "0x0";
    if (payload.method === "eth_chainId") result = "0x7bb";
    if (payload.method === "eth_blockNumber") result = "0x2a10000";
    if (payload.method === "eth_getCode") result = "0x60006000";
    if (payload.method === "eth_maxPriorityFeePerGas" || payload.method === "eth_gasPrice") result = "0x3b9aca00";
    if (payload.method === "eth_getTransactionCount") result = "0x1";
    if (payload.method === "eth_estimateGas") result = "0x2dc6c0";
    if (payload.method === "eth_call") {
      const call = payload.params?.[0] as { to?: string; data?: string } | undefined;
      if (call?.to?.toLowerCase().endsWith("0803")) result = `0x${1979n.toString(16).padStart(64, "0")}`;
      else if (call?.data?.startsWith(toFunctionSelector("balanceOf(address)"))) result = `0x${(10n ** 18n).toString(16).padStart(64, "0")}`;
      else if (call?.data?.startsWith(toFunctionSelector("lockUntil(address)"))) result = `0x${50_000_000n.toString(16).padStart(64, "0")}`;
      else if (call?.data?.startsWith(toFunctionSelector("getServicesByCapability(uint8,bool)"))) {
        result = encodeAbiParameters(
          parseAbiParameters("((address,address,uint8,bytes,string,bytes32,uint8),bool,bytes32)[]"),
          [[[[TEST_ACCOUNT, TEST_EXECUTOR, 0, TEST_PUBLIC_KEY, "", ZERO_HASH, 0], true, ZERO_HASH]]],
        );
      }
      else if (call?.data?.startsWith(toFunctionSelector("consumerOf(address)"))) {
        factoryLookupCount += 1;
        const consumer = firstTimeSchedulerWallet && factoryLookupCount === 1 ? "0x0000000000000000000000000000000000000000" : SCHEDULER_CONSUMER;
        result = encodeAbiParameters(parseAbiParameters("address"), [consumer]);
      }
      else if (call?.data?.startsWith(toFunctionSelector("predictConsumer(address)"))) {
        result = encodeAbiParameters(parseAbiParameters("address"), [PREDICTED_SCHEDULER_CONSUMER]);
      }
      else if (call?.data?.startsWith(toFunctionSelector("predictHarness(address,bytes32)"))) {
        result = encodeAbiParameters(parseAbiParameters("address,bytes32"), [PREDICTED_AGENT_HARNESS, ZERO_HASH]);
      }
      else if (call?.data?.startsWith(toFunctionSelector("owner()"))) result = encodeAbiParameters(parseAbiParameters("address"), [TEST_ACCOUNT]);
      else if (call?.data?.startsWith(toFunctionSelector("consumerBalance()"))) result = encodeAbiParameters(parseAbiParameters("uint256"), [400_000_000_000_000n]);
      else if (call?.data?.startsWith(toFunctionSelector("activeScheduleId()"))) result = encodeAbiParameters(parseAbiParameters("uint256"), [0n]);
      else if (call?.data?.startsWith(toFunctionSelector("lastScheduleId()"))) result = encodeAbiParameters(parseAbiParameters("uint256"), [3_146_449n]);
      else if (call?.data?.startsWith(toFunctionSelector("activeScheduleState()"))) result = encodeAbiParameters(parseAbiParameters("uint8"), [2]);
      else if (call?.data?.startsWith(toFunctionSelector("executionCount()"))) result = encodeAbiParameters(parseAbiParameters("uint256"), [1n]);
      else if (call?.data?.startsWith(toFunctionSelector("lastExecutionIndex()"))) result = encodeAbiParameters(parseAbiParameters("uint256"), [0n]);
      else if (call?.data?.startsWith(toFunctionSelector("activeNumCalls()"))) result = encodeAbiParameters(parseAbiParameters("uint32"), [1]);
      else if (call?.data?.startsWith(toFunctionSelector("lastResult()"))) {
        result = encodeAbiParameters(
          parseAbiParameters("bytes"),
          [encodeAbiParameters(parseAbiParameters("uint256"), [1979n])],
        );
      }
      else result = "0x" + "0".repeat(64);
    }
    if (payload.method === "eth_getLogs") result = [];
    if (payload.method === "eth_getTransactionReceipt") {
      result = payload.params?.[0] === FIXTURE_LLM_TX_HASH ? ritualReceiptFixtures.llmSuccess : ritualReceiptFixtures.success;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }),
    });
  });
});

test("imports and decodes an HTTP transaction without overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("HTTP consumer")).toHaveValue(CONSUMER);
  await page.getByLabel("Import tx hash").fill(TX_HASH);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByText("HTTP 200 · 1 headers · 11 bytes")).toBeVisible();
  await page.getByText("Response details", { exact: true }).click();
  await expect(page.getByText('{ "ok": true }')).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("runs the synchronous JQ recipe without a wallet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "JQ Live recipe", exact: true }).click();
  await page.getByRole("button", { name: "Run JQ", exact: true }).click();

  const result = page.getByTestId("jq-result");
  await expect(result.getByText("uint256", { exact: true })).toBeVisible();
  await expect(result.getByText("1979", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("submits and decodes an LLM completion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "0x1111...1111", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "LLM Ritual degraded recipe", exact: true }).click();
  const send = page.getByRole("button", { name: "Send LLM", exact: true });
  await expect(send).toBeEnabled();
  await send.click();

  const result = page.getByTestId("llm-result");
  await expect(result.getByText("Completion ready", { exact: true })).toBeVisible();
  await expect(result.getByText("Ritual LLM online.", { exact: true })).toBeVisible();
  await expect(result.getByText("17 tokens", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("prepares the factory-backed Agent launch without overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Agent Live recipe", exact: true }).click();
  const launch = page.getByTestId("agent-launch");
  await expect(launch.getByText("Your wallet", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Use", exact: true }).first().click();

  await expect(launch.getByText("Registry verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready to launch", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(launch.getByRole("button", { name: "Start Agent", exact: true })).toBeEnabled();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("reconciles the completed Scheduled JQ lifecycle without overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Scheduled JQ Live recipe", exact: true }).click();

  const workflow = page.getByTestId("scheduler-workflow");
  await expect(workflow.getByText("Completed", { exact: true })).toBeVisible();
  await expect(workflow.getByText("Schedule created", { exact: true })).toBeVisible();
  await expect(workflow.getByText("Execution 1 completed", { exact: true })).toBeVisible();
  await expect(workflow.getByText("Schedule completed", { exact: true })).toBeVisible();
  await expect(workflow.getByText("1979", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("creates its Scheduled JQ consumer without leaving the composer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Scheduled JQ Live recipe", exact: true }).click();

  const workflow = page.getByTestId("scheduler-workflow");
  await expect(workflow.getByText("Consumer not created", { exact: true })).toBeVisible();
  await expect(workflow.getByText("0x3333...3333", { exact: true })).toBeVisible();
  const create = page.getByRole("button", { name: "Create consumer", exact: true });
  await expect(create).toBeEnabled();
  await create.click();

  await expect(workflow.getByText("Completed", { exact: true })).toBeVisible();
  await expect(workflow.getByText("0x7243...A668", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});
