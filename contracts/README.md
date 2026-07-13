# Precompile Studio Contracts

The repository contains owned consumers for HTTP, non-streaming LLM inference, and Scheduled JQ, plus the factory-compatible Sovereign Agent harness.

## HTTP Consumer

`HttpPrecompileConsumer.sol` is Precompile Studio's owned consumer for Ritual's short-running HTTP precompile. It uses `PrecompileConsumer` to unwrap Ritual's `(simmedInput, actualOutput)` envelope before decoding the five-field HTTP response.

Full headers and body data remain available in `receipt.spcCalls`. The contract stores compact evidence only: caller, HTTP status, body length, body hash, and error hash.

## Current Ritual Testnet Deployment

The latest public deployment is recorded in [`../deployments/ritual-testnet.json`](../deployments/ritual-testnet.json).

## Build

```bash
npm run consumer:build
npm run consumer:test
```

## Deploy To Ritual Testnet

Use a testnet-only private key. Do not paste a funded main wallet key into a shell history or commit it to the repo.

```bash
export RITUAL_PRIVATE_KEY=0x...
forge create \
  --broadcast \
  --rpc-url https://rpc.ritualfoundation.org \
  --private-key "$RITUAL_PRIVATE_KEY" \
  contracts/HttpPrecompileConsumer.sol:HttpPrecompileConsumer
```

Or through npm:

```bash
RITUAL_PRIVATE_KEY=0x... npm run consumer:deploy
```

After deployment, update `deployments/ritual-testnet.json`; the frontend reads its default consumer address from that file.

## Runtime Flow

1. Compose an HTTP precompile payload in Precompile Studio.
2. Fund `RitualWallet` from the inspector if escrow is empty.
3. Confirm the configured HTTP consumer has bytecode.
4. Send `callHTTPCallRaw(bytes)` from the consumer panel.
5. Watch HTTP history for the receipt, `spcCalls`, decoded response, and compact `HttpResult` evidence.

The connected wallet still pays its own Ritual testnet gas and precompile fees.

## Scheduled JQ Consumer

`ScheduledJqConsumer.sol` is an owner-operated Scheduler callback contract. It funds its own RitualWallet account, enforces Ritual's `0.01 RITUAL` Scheduler reserve plus the complete execution budget, schedules JQ precompile calls, records callback results, and exposes local lifecycle state after the Scheduler removes a completed one-shot call from its own storage.

`fundAndSchedule` combines the escrow top-up and schedule creation in one payable transaction. `cancelSchedule` and `withdraw` remain owner-only, and RitualWallet still enforces the configured escrow lock before withdrawal.

The current Ritual testnet deployment is `0x7243c1A2cA1Ea555416951480B147c27b17eA668`. The verified smoke call and deployment transactions are recorded in [`../deployments/ritual-testnet.json`](../deployments/ritual-testnet.json).
