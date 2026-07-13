# Precompile Studio Test Guide

This guide separates four different outcomes: local encoding, wallet submission, Ritual transaction confirmation, and the external precompile result. A confirmed transaction does not by itself guarantee that an HTTP server or LLM executor returned useful output.

## Before You Start

1. Install MetaMask. Rabby can read the app, but its current Ritual custom-network transaction handling cannot submit the supported transaction type.
2. Get testnet RITUAL from the [Ritual faucet](https://faucet.ritualfoundation.org/).
3. Open Precompile Studio and press **Connect**.
4. If MetaMask is on another network, use **Switch**. The studio switches to Ritual testnet or offers to add it with chain ID `1979`, RPC `https://rpc.ritualfoundation.org`, and symbol `RITUAL`.
5. Confirm the header shows Ritual gas balance and chain `1979` before testing a transaction recipe.

## JQ: Public, No Wallet Required

1. Open **JQ**.
2. Keep query `.data.price`, input `{"data":{"price":1979}}`, and output type `uint256`.
3. Press **Run JQ**.
4. Expect **JQ result**, type `uint256`, and value `1979`.

This is a synchronous `eth_call` to precompile `0x0803`. It does not spend gas or ask for a wallet signature.

## HTTP: Public Transaction Flow

1. Connect MetaMask on Ritual testnet.
2. Open **HTTP** and load **Example: HTTP 200 echo**.
3. In **Registry discovery**, choose an HTTP candidate and press **Use**.
4. Resolve any remaining inspector blockers. If RitualWallet escrow is empty or its lock is too short, use **Fund RitualWallet** and confirm the deposit.
5. Press **Send HTTP tx** and confirm in MetaMask.
6. Expect the run to appear under **Recent HTTP txs** as pending, then confirmed or failed.
7. For a successful call, open **Response details** and verify the HTTP status, headers, and body. Use **Explorer** to inspect the transaction independently.

The connected user pays transaction gas and async precompile fees. A confirmed transaction with a precompile or HTTP error is still shown as an error rather than as a successful response.

## LLM: Public Submission, Degraded Executor

1. Connect MetaMask and open **LLM**.
2. Keep streaming disabled. The verified consumer only supports the non-streaming path.
3. Keep the default model and message or replace the prompt with a short test.
4. Confirm a capability-1 executor is selected, then press **Send LLM**.
5. Confirm the transaction in MetaMask.
6. Expect either a decoded completion with model and token metadata, or a specific executor/precompile error.

The Studio submission and receipt decoder are live. Ritual's current executor path may return a certificate or registry infrastructure error; the UI should show that result without calling it a model completion.

## Sovereign Agent: Deployed Owner Only

1. Open **Agent**.
2. Check the harness owner shown in **Sovereign Agent harness**.
3. Connect that exact owner address. Other wallets can inspect and compose the recipe but cannot launch the owner-controlled harness.
4. Select a discovered capability-0 executor and verify **Registry verified**.
5. Review the prompt, model, schedule funding, and encrypted provider configuration.
6. Press **Start Agent** and confirm the payable transaction.
7. Expect lifecycle states to move through scheduled, committed, result ready, and settled, or to show failed/expired with the on-chain evidence available.

The harness was factory-deployed and its callback wiring is verified. Final Agent output still depends on Ritual's TEE and AsyncDelivery infrastructure.

## Scheduled JQ: Per-Wallet Consumer

1. Open **Scheduled JQ**.
2. Connect MetaMask. The studio asks the factory for this wallet's consumer.
3. If the panel shows **Consumer not created**, press **Create consumer** and confirm the one-time deployment transaction. The panel should switch to **Ready to schedule** after inclusion.
4. Keep the smoke values: filter `.data.price`, input `{"data":{"price":1979}}`, output `uint256`, frequency `20`, executions `1`, callback gas `200000`, window `100`, and max fee `2000000000`.
5. Review **Required escrow**. It includes Ritual's `0.01 RITUAL` Scheduler reserve plus the full execution budget.
6. Press **Fund & schedule** when escrow is short, or **Schedule JQ** when it is already funded. Confirm the single transaction in MetaMask.
7. Expect a call ID and **Schedule created** in the on-chain lifecycle.
8. After the scheduled block, expect **Execution completed**, **Schedule completed**, and decoded result `1979`.
9. Use **Cancel** while a schedule is active. Use **Withdraw** only after the consumer escrow lock expires.

The verified factory-child smoke call is `3147825`. Its creation and execution transactions are linked from the lifecycle panel and recorded in `deployments/ritual-testnet.json`.

## What To Report

When a test fails, include the recipe name, connected wallet type, transaction hash, lifecycle stage, and exact on-screen error. Do not share a private key, seed phrase, provider credential, or encrypted secret payload.
