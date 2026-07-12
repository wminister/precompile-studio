import { expect, test } from "@playwright/test";
import {
  FIXTURE_CONSUMER_ADDRESS,
  FIXTURE_TX_HASH,
  ritualReceiptFixtures,
} from "../src/__fixtures__/ritualReceipts";

const RPC_URL = "https://rpc.ritualfoundation.org";
const TX_HASH = FIXTURE_TX_HASH;
const CONSUMER = FIXTURE_CONSUMER_ADDRESS;

test.beforeEach(async ({ page }) => {
  await page.route(RPC_URL, async (route) => {
    const payload = route.request().postDataJSON() as { id: number; method: string; params?: unknown[] };
    let result: unknown = "0x0";
    if (payload.method === "eth_chainId") result = "0x7bb";
    if (payload.method === "eth_blockNumber") result = "0x2a10000";
    if (payload.method === "eth_getCode") result = "0x60006000";
    if (payload.method === "eth_call") {
      const call = payload.params?.[0] as { to?: string } | undefined;
      result = call?.to?.toLowerCase().endsWith("0803")
        ? `0x${1979n.toString(16).padStart(64, "0")}`
        : "0x" + "0".repeat(64);
    }
    if (payload.method === "eth_getTransactionReceipt") result = ritualReceiptFixtures.success;
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
  await page.getByRole("button", { name: "JQ", exact: true }).click();
  await page.getByRole("button", { name: "Run JQ", exact: true }).click();

  const result = page.getByTestId("jq-result");
  await expect(result.getByText("uint256", { exact: true })).toBeVisible();
  await expect(result.getByText("1979", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});
