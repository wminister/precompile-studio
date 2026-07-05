# Precompile Studio

Precompile Studio is a Ritual-native workspace for composing, checking, and tracing async precompile calls.

The goal is to feel closer to Postman or Tenderly than a chain dashboard: one primary action composer, live readiness checks, and a trace surface that helps builders understand what happened after they sign.

## Current MVP

- Ritual testnet RPC health check
- Live block number and latency
- Browser wallet connection
- Ritual chain switch/add flow for chain ID `1979`
- Wallet balance readout
- RitualWallet deposit flow for funding precompile escrow
- Minimal HTTP runner contract source
- Verified Ritual testnet HTTP runner deployment metadata
- Runner transaction calldata generation and wallet submit flow
- Runner contract bytecode verification before wallet submit
- Runner deployment checklist with copyable build/deploy commands
- Persisted runner transaction history scoped by wallet or local browser, with receipt polling
- Explorer-linked runner transactions using Ritual's `/tx/{hash}` route
- Transaction hash import for externally submitted runner calls
- Runner history JSON copy/import for moving traces between browsers
- Runner history status filters for pending, confirmed, and failed calls
- Compact transaction trace rows for receipt, `spcCalls`, and decoded `HttpResult` callback completion with small UTF-8 body previews
- Local saved runner contracts scoped by wallet
- Local saved TEE executors scoped by wallet
- Local recipe presets for saving and reloading composer fields
- Built-in HTTP, LLM, JQ, and Sovereign Agent recipe examples
- Live HTTP, LLM, JQ, and Sovereign Agent recipe composers, with a Scheduler shell
- Request preview with copy action
- Guardrail inspector for common pre-submit blockers
- Responsive app layout for desktop and mobile

## Ritual Links

- Docs: <https://docs.ritualfoundation.org>
- Faucet: <https://faucet.ritualfoundation.org>
- Explorer: <https://explorer.ritualfoundation.org>
- RPC: <https://rpc.ritualfoundation.org>

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Design Direction

See [`DESIGN.md`](./DESIGN.md) before making UI changes. The app should stay close to Ritual Explorer's calm, dense, dark builder-tool aesthetic and avoid generic dashboard sprawl.

## Build

```bash
npm run build
```

The build verifies recipe example JSON and ABI smoke encoding before writing production output to `dist/`.

## HTTP Runner

The minimal Solidity runner lives at [`contracts/HttpPrecompileRunner.sol`](./contracts/HttpPrecompileRunner.sol).

The current Ritual testnet deployment is tracked in [`deployments/ritual-testnet.json`](./deployments/ritual-testnet.json) and prefilled in the runner panel.

Deploy it to Ritual testnet, paste the deployed address into Precompile Studio, then use the HTTP composer to generate and submit `fetchHttp(bytes)` calldata. The studio checks that bytecode exists at the runner address before enabling wallet submission. Users still pay their own gas and confirm the transaction in their wallet.

Submitted runner transactions are stored locally, scoped to the connected wallet when available, and polled through the Ritual RPC until a receipt is available. When the receipt includes Ritual-specific `spcCalls`, the studio surfaces that evidence beside the transaction hash. If the runner emits `HttpResult`, the trace decodes the callback status code, response byte count, and error message.

External transaction hashes can also be imported into the runner history, which is useful when a call was submitted from a wallet, terminal, or explorer outside the current browser session.

Runner history can be copied or imported as JSON from the runner panel, allowing trace evidence to move between local browsers without connecting a backend account.

Runner contract addresses can be saved locally and reused from the runner panel. Saved runners are scoped to the connected wallet when available, with a local fallback before wallet connection.

TEE executor addresses can also be saved locally from recipes that need an executor, currently HTTP, LLM, and Sovereign Agent. The executor value still comes from `TEEServiceRegistry`; the studio only remembers addresses the builder has confirmed.

Composer fields can also be saved as local recipe presets. Presets are stored in the browser, can be loaded back into the matching recipe tab, and can be copied/imported as JSON. See [`docs/presets.md`](./docs/presets.md), [`examples/http-preset.json`](./examples/http-preset.json), [`examples/llm-preset.json`](./examples/llm-preset.json), [`examples/jq-preset.json`](./examples/jq-preset.json), and [`examples/agent-preset.json`](./examples/agent-preset.json) for the preset format.

See [`contracts/README.md`](./contracts/README.md) for runner build and deployment steps.

```bash
npm run runner:build
RITUAL_PRIVATE_KEY=0x... npm run runner:deploy
```

## Vercel

Recommended settings:

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

After importing the GitHub repo into Vercel, add the custom domain in Vercel and copy the requested DNS records to the domain registrar.

### GitHub Actions Deployment

This repo deploys through GitHub Actions instead of Vercel's native GitHub integration.

Required repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow runs on pushes to `main` and can also be triggered manually from the GitHub Actions tab.

## Next Milestones

1. Add more live recipe templates beyond HTTP, LLM, JQ, and Sovereign Agent.
2. Add registry-backed executor discovery once Ritual exposes a stable executor lookup surface.
