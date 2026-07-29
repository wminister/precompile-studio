import { readFile } from "node:fs/promises";

const productionUrl = process.env.PRODUCTION_URL ?? "https://www.precompilestudio.xyz";
const deployments = JSON.parse(await readFile(new URL("../deployments/ritual-testnet.json", import.meta.url), "utf8"));
const contractAddresses = [
  deployments.contracts.HttpPrecompileConsumer.address,
  deployments.contracts.LlmPrecompileConsumer.address,
  deployments.contracts.SovereignAgentHarness.address,
  deployments.contracts.SovereignAgentOneShotConsumerFactory.address,
  deployments.contracts.SovereignAgentOneShotConsumerFactory.deployerConsumer,
  deployments.contracts.ScheduledJqConsumer.address,
  deployments.contracts.ScheduledJqConsumerFactory.address,
].map((address) => address.toLowerCase());
const requiredProductCopy = [
  "Paid Agent launch paused",
  "roughly 0.31 RITUAL per in-flight call",
  "Inspection-only recipe",
  "Ritual degraded",
  "Withdraw unlocked escrow",
  "Withdraw Agent escrow",
  "Registry valid + live key",
  "Current registry route",
];
const attempts = 6;

async function check() {
  const response = await fetch(productionUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`home returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes("<title>Precompile Studio</title>")) throw new Error("home title is missing");
  if (!html.includes('property="og:image"')) throw new Error("Open Graph image metadata is missing");
  if (!html.includes('rel="icon"')) throw new Error("favicon metadata is missing");
  const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  if (!scriptPath) throw new Error("production JavaScript asset is missing");
  const script = await fetch(new URL(scriptPath, response.url)).then((asset) => asset.text());
  const normalizedScript = script.toLowerCase();
  const missingAddress = contractAddresses.find((address) => !normalizedScript.includes(address));
  if (missingAddress) throw new Error(`deployment ${missingAddress} is not in the production bundle`);
  const missingProductCopy = requiredProductCopy.find((copy) => !script.includes(copy));
  if (missingProductCopy) throw new Error(`required product copy is missing: ${missingProductCopy}`);

  const faq = await fetch(new URL("/faq", response.url));
  if (!faq.ok) throw new Error(`FAQ returned HTTP ${faq.status}`);
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await check();
    console.log(JSON.stringify({ ok: true, productionUrl, contractAddresses }));
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

throw lastError;
