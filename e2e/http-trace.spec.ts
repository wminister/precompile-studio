import { expect, test } from "@playwright/test";
import { toFunctionSelector } from "viem";
import {
  FIXTURE_CONSUMER_ADDRESS,
  FIXTURE_LLM_TX_HASH,
  FIXTURE_TX_HASH,
  ritualReceiptFixtures,
} from "../src/__fixtures__/ritualReceipts";

const RPC_URL = "https://rpc.ritualfoundation.org";
const TX_HASH = FIXTURE_TX_HASH;
const CONSUMER = FIXTURE_CONSUMER_ADDRESS;

test.beforeEach(async ({ page }) => {
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
      else result = "0x" + "0".repeat(64);
    }
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
  await page.getByRole("tab", { name: "JQ live recipe", exact: true }).click();
  await page.getByRole("button", { name: "Run JQ", exact: true }).click();

  const result = page.getByTestId("jq-result");
  await expect(result.getByText("uint256", { exact: true })).toBeVisible();
  await expect(result.getByText("1979", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("submits and decodes an LLM completion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "0x1111...1111", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "LLM live recipe", exact: true }).click();
  const send = page.getByRole("button", { name: "Send LLM", exact: true });
  await expect(send).toBeEnabled();
  await send.click();

  const result = page.getByTestId("llm-result");
  await expect(result.getByText("Completion ready", { exact: true })).toBeVisible();
  await expect(result.getByText("Ritual LLM online.", { exact: true })).toBeVisible();
  await expect(result.getByText("17 tokens", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});
