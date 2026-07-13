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
- Owned HTTP consumer using Ritual's async-envelope unwrapping pattern
- Foundry coverage for successful, HTTP-error, and reverted precompile calls
- HTTP consumer calldata generation and wallet submit flow
- HTTP consumer bytecode verification before wallet submit
- Persisted HTTP transaction history scoped by wallet or local browser, with receipt polling
- Explorer-linked HTTP transactions using Ritual's `/tx/{hash}` route
- Transaction hash import for externally submitted HTTP calls
- HTTP history JSON copy/import for moving traces between browsers
- HTTP history status filters for pending, confirmed, and failed transactions
- Distinct transaction, precompile, and HTTP response states decoded from `receipt.spcCalls`
- Expandable HTTP response headers and formatted JSON or text bodies
- Local saved HTTP consumer contracts scoped by wallet
- Local saved TEE executors scoped by wallet
- Local recipe presets for saving and reloading composer fields
- Built-in HTTP, LLM, JQ, Sovereign Agent, and Scheduler recipe examples
- Live HTTP, LLM, JQ, Sovereign Agent, and Scheduler calldata composers
- Factory-backed Sovereign Agent launch with registry-key ECIES encryption, harness ownership checks, and lifecycle reconciliation
- Request preview with copy action
- Copyable normalized call JSON for encoded live recipes
- Copyable Foundry `cast send` commands for encoded live recipes
- Guardrail inspector for common pre-submit blockers
- Local secret-looking field warnings before copying or sharing drafts
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

## Tests

```bash
npm run test
npm run consumer:test
npm run test:e2e
```

Vitest covers every recipe encoder, Ritual HTTP receipt outcomes, and mocked EIP-1193 wallet flows. Foundry covers the owned consumer contract. Playwright imports a mocked Ritual receipt at desktop and mobile widths and checks the decoded response and horizontal overflow. GitHub runs all three suites before production deployment, then checks the deployed bundle with `npm run smoke:production`.

## HTTP Consumer

The studio defaults to its owned HTTP consumer at `0x30a2132b7f47A30E2D55A191F6723161C232263C`, which exposes `callHTTPCallRaw(bytes)` on Ritual testnet.

The source lives at [`contracts/HttpPrecompileConsumer.sol`](./contracts/HttpPrecompileConsumer.sol), with envelope handling in [`contracts/utils/PrecompileConsumer.sol`](./contracts/utils/PrecompileConsumer.sol). Deployment and smoke-transaction evidence are tracked in [`deployments/ritual-testnet.json`](./deployments/ritual-testnet.json).

Use the HTTP composer to encode a request, select a registered TEE executor, and submit `callHTTPCallRaw(bytes)` through the configured consumer. The studio checks that bytecode exists at the consumer address before enabling wallet submission. Users still pay their own gas and confirm the transaction in their wallet.

Submitted HTTP transactions are stored locally, scoped to the connected wallet when available, and polled through the Ritual RPC until a receipt is available. The trace decodes Ritual's five-field HTTP output from `receipt.spcCalls`, keeping transaction confirmation, precompile errors, and target-server HTTP status separate.

External transaction hashes can also be imported into HTTP history, which is useful when a call was submitted from a wallet, terminal, or explorer outside the current browser session.

HTTP history can be copied or imported as JSON, allowing trace evidence to move between local browsers without connecting a backend account.

HTTP consumer addresses can be saved locally and reused from the consumer panel. Saved consumers are scoped to the connected wallet when available, with a local fallback before wallet connection.

## LLM Consumer

[`contracts/LlmPrecompileConsumer.sol`](./contracts/LlmPrecompileConsumer.sol) applies the same Ritual envelope-unwrapping pattern to LLM inference. It stores compact hashes and lengths for completion and model metadata plus error and conversation-history evidence. Full model output remains in `receipt.spcCalls` for the studio to decode without duplicating large response bytes in contract storage.

The deployed Ritual testnet consumer is `0x6f78351167AA672e75948dc802FDf96f77E87Dfa`. The studio submits non-streaming calls through it, polls the settled receipt, and decodes completion, usage, model metadata, and executor errors from `spcCalls`. Capability `1` is the verified LLM registry slot; streaming remains a separate capability and is not sent through this path.

TEE executor addresses can also be saved locally from recipes that need an executor, currently HTTP, LLM, and Sovereign Agent. The executor value still comes from `TEEServiceRegistry`; the studio only remembers addresses the builder has confirmed.

## Sovereign Agent Harness

The Agent recipe uses the factory-deployed harness at `0x8067904eA53D7D0418AC0B5F87d2b4c7a59dE2Fe`. The studio discovers a capability-0 executor and its public key from `TEEServiceRegistry`, encrypts the credential-free Ritual provider configuration in the browser, and submits `configureFundAndStart` to the harness from its owner wallet.

The default launch funds five scheduled calls, runs every 2,000 blocks, and locks the harness funding for 100,000 blocks. The studio reads the harness owner, series state, and sender lock, then reconciles `JobAdded`, `Phase1Settled`, `ResultDelivered`, `JobRemoved`, and the harness callback event into user-facing lifecycle states. Scheduler funding and transaction gas are paid by the wallet that confirms the launch.

Composer fields can also be saved as local recipe presets. Presets are stored in the browser, can be loaded back into the matching recipe tab, and can be copied/imported as JSON. See [`docs/presets.md`](./docs/presets.md), [`examples/http-preset.json`](./examples/http-preset.json), [`examples/llm-preset.json`](./examples/llm-preset.json), [`examples/jq-preset.json`](./examples/jq-preset.json), [`examples/agent-preset.json`](./examples/agent-preset.json), and [`examples/scheduler-preset.json`](./examples/scheduler-preset.json) for the preset format.

See [`contracts/README.md`](./contracts/README.md) for build, test, and deployment details, and [`ROADMAP.md`](./ROADMAP.md) for the remaining milestones.

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

The ordered milestones and their completion state live in [`ROADMAP.md`](./ROADMAP.md).
