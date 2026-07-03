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
- HTTP, LLM, Agent, and Scheduler recipe shells
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

The production output is written to `dist/`.

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

1. Add a minimal Solidity callback runner for HTTP precompile calls.
2. Generate runner transaction calldata from the encoded HTTP input.
3. Submit runner transactions from the connected wallet.
4. Parse receipts and surface `spcCalls`.
5. Track async job lifecycle and callback completion.
