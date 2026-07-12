# HTTP Precompile Consumer

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
