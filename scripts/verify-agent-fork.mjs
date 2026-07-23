import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  parseEther,
} from "viem";

const rpcUrl = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8547";
const owner = process.env.FORK_OWNER ?? "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const harness = process.env.FORK_HARNESS;
const executor = process.env.AGENT_EXECUTOR ?? "0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C";
const ritualFork = defineChain({
  id: 1979,
  name: "Ritual local fork",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

if (!harness) {
  throw new Error("Set FORK_HARNESS to a fresh harness deployed on the local fork.");
}

const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: ritualFork, transport });
const walletClient = createWalletClient({ account: owner, chain: ritualFork, transport });
const latestBlock = await publicClient.getBlockNumber();

const storageRef = [
  { name: "platform", type: "string" },
  { name: "path", type: "string" },
  { name: "keyRef", type: "string" },
];

const params = {
  name: "params",
  type: "tuple",
  components: [
    { name: "executor", type: "address" },
    { name: "ttl", type: "uint256" },
    { name: "toolSchema", type: "bytes" },
    { name: "pollInterval", type: "uint64" },
    { name: "maxPollBlock", type: "uint64" },
    { name: "taskIdMarker", type: "string" },
    { name: "deliveryTarget", type: "address" },
    { name: "deliverySelector", type: "bytes4" },
    { name: "deliveryGasLimit", type: "uint256" },
    { name: "deliveryMaxFeePerGas", type: "uint256" },
    { name: "deliveryMaxPriorityFeePerGas", type: "uint256" },
    { name: "cliType", type: "uint16" },
    { name: "prompt", type: "string" },
    { name: "encryptedSecrets", type: "bytes" },
    { name: "convoHistory", type: "tuple", components: storageRef },
    { name: "output", type: "tuple", components: storageRef },
    { name: "skills", type: "tuple[]", components: storageRef },
    { name: "systemPrompt", type: "tuple", components: storageRef },
    { name: "model", type: "string" },
    { name: "tools", type: "string[]" },
    { name: "maxTurns", type: "uint16" },
    { name: "maxTokens", type: "uint32" },
    { name: "rpcUrls", type: "string" },
  ],
};

const schedule = {
  name: "schedule",
  type: "tuple",
  components: [
    { name: "schedulerGas", type: "uint32" },
    { name: "frequency", type: "uint32" },
    { name: "schedulerTtl", type: "uint32" },
    { name: "maxFeePerGas", type: "uint256" },
    { name: "maxPriorityFeePerGas", type: "uint256" },
    { name: "value", type: "uint256" },
  ],
};

const rolling = {
  name: "rolling",
  type: "tuple",
  components: [
    { name: "windowNumCalls", type: "uint32" },
    { name: "rolloverThresholdBps", type: "uint16" },
    { name: "rolloverRetryEveryCalls", type: "uint16" },
  ],
};

const configureAbi = [{
  name: "configureFundAndStart",
  type: "function",
  stateMutability: "payable",
  inputs: [params, schedule, rolling, { name: "lockDuration", type: "uint256" }],
  outputs: [{ name: "callId", type: "uint256" }],
}];

const statusAbi = [
  {
    name: "configured",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "wakeMode",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "activeCallId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

const emptyStorage = { platform: "", path: "", keyRef: "" };
const calldata = encodeFunctionData({
  abi: configureAbi,
  functionName: "configureFundAndStart",
  args: [
    {
      executor,
      ttl: 500n,
      toolSchema: "0x",
      pollInterval: 5n,
      maxPollBlock: latestBlock + 10_000_000n,
      taskIdMarker: "SOVEREIGN_AGENT_TASK",
      deliveryTarget: harness,
      deliverySelector: "0x8ca12055",
      deliveryGasLimit: 3_000_000n,
      deliveryMaxFeePerGas: 1_000_000_000n,
      deliveryMaxPriorityFeePerGas: 100_000_000n,
      cliType: 6,
      prompt: "Explain Ritual precompiles in one concise sentence.",
      encryptedSecrets: "0x1234",
      convoHistory: emptyStorage,
      output: emptyStorage,
      skills: [],
      systemPrompt: emptyStorage,
      model: "zai-org/GLM-4.7-FP8",
      tools: [],
      maxTurns: 5,
      maxTokens: 2048,
      rpcUrls: "",
    },
    {
      schedulerGas: 500_000,
      frequency: 2_000,
      schedulerTtl: 500,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      value: 0n,
    },
    {
      windowNumCalls: 1,
      rolloverThresholdBps: 5_000,
      rolloverRetryEveryCalls: 1,
    },
    100_000n,
  ],
});

await publicClient.call({
  account: owner,
  to: harness,
  data: calldata,
  value: parseEther("0.02"),
  gas: 10_000_000n,
});

const hash = await walletClient.sendTransaction({
  to: harness,
  data: calldata,
  value: parseEther("0.02"),
  gas: 10_000_000n,
  maxFeePerGas: 20_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });

const [configured, wakeMode, activeCallId] = await Promise.all([
  publicClient.readContract({ address: harness, abi: statusAbi, functionName: "configured" }),
  publicClient.readContract({ address: harness, abi: statusAbi, functionName: "wakeMode" }),
  publicClient.readContract({ address: harness, abi: statusAbi, functionName: "activeCallId" }),
]);

if (receipt.status !== "success" || !configured || wakeMode !== 1 || activeCallId === 0n) {
  throw new Error(
    `Agent fork verification failed: receipt=${receipt.status}, configured=${configured}, wakeMode=${wakeMode}, activeCallId=${activeCallId}`,
  );
}

console.log(JSON.stringify({
  receipt: receipt.status,
  configured,
  wakeMode,
  activeCallId: activeCallId.toString(),
  profile: {
    schedulerGas: 500_000,
    frequency: 2_000,
    ttl: 500,
    maxFeeGwei: 20,
    priorityFeeGwei: 1,
    totalFundingRitual: "0.02",
  },
}, null, 2));
