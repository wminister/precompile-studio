# HTTP Precompile Runner

`HttpPrecompileRunner.sol` is a minimal helper contract for calling Ritual's HTTP precompile from a normal wallet transaction.

## Build

```bash
forge build
```

Or through npm:

```bash
npm run runner:build
```

## Deploy To Ritual Testnet

Use a testnet-only private key. Do not paste a funded main wallet key into a shell history or commit it to the repo.

```bash
export RITUAL_PRIVATE_KEY=0x...
forge create \
  --rpc-url https://rpc.ritualfoundation.org \
  --private-key "$RITUAL_PRIVATE_KEY" \
  contracts/HttpPrecompileRunner.sol:HttpPrecompileRunner
```

Or through npm:

```bash
RITUAL_PRIVATE_KEY=0x... npm run runner:deploy
```

After deployment, copy the deployed contract address into Precompile Studio's runner panel and save it as a runner contract.

## Runtime Flow

1. Compose an HTTP precompile payload in Precompile Studio.
2. Fund `RitualWallet` from the inspector if escrow is empty.
3. Paste or load the deployed runner address.
4. Send `fetchHttp(bytes)` from the runner panel.
5. Watch the submitted transaction history for the receipt and `spcCalls` evidence.

The connected wallet still pays its own Ritual testnet gas and precompile fees.
