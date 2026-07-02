# Precompile Studio

Precompile Studio is a Ritual-native workspace for composing, checking, and tracing async precompile calls.

The goal is to feel closer to Postman or Tenderly than a chain dashboard: one primary action composer, live readiness checks, and a trace surface that helps builders understand what happened after they sign.

## Current MVP

- Ritual testnet RPC health check
- Live block number and latency
- Browser wallet connection
- Ritual chain switch/add flow for chain ID `1979`
- Wallet balance readout
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

## Next Milestones

1. Add a minimal Solidity callback runner for HTTP precompile calls.
2. Encode calldata from the composer instead of only previewing JSON.
3. Submit real testnet transactions from the connected wallet.
4. Parse receipts and surface `spcCalls`.
5. Track async job lifecycle and callback completion.
