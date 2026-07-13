# Precompile Studio Roadmap

This roadmap records the remaining work required to turn every advertised recipe into a dependable end-to-end Ritual workflow. Items are ordered by user-visible reliability and technical dependency.

## Phase 1: Reliable HTTP Flow

- [x] Replace the failing default HTTP example with a stable HTTP 200 endpoint.
- [x] Decode the complete HTTP response tuple, including precompile `errorMessage`.
- [x] Separate transaction, HTTP, and precompile status in the trace.
- [x] Show response headers and formatted JSON or text bodies.
- [x] Prevent another HTTP submission while this browser has a pending async transaction for the connected wallet.
- [x] Use "HTTP consumer" terminology in the interface.

## Phase 2: Owned HTTP Consumer

- [x] Replace the obsolete optional runner contract with Ritual's supported `PrecompileConsumer` pattern.
- [x] Add contract tests for envelope unwrapping, response storage, and emitted evidence.
- [x] Deploy and verify the owned consumer on Ritual testnet.
- [x] Make the owned deployment the default and remove obsolete deployment guidance.

## Phase 3: Automated Regression Coverage

- [x] Add unit tests for every recipe encoder and decoder.
- [x] Add receipt fixtures for HTTP success, HTTP error, precompile error, revert, malformed output, and pending transactions.
- [x] Add mocked EIP-1193 wallet tests for connect, chain switch, deposit, and send.
- [x] Add browser tests for desktop and mobile critical paths.
- [x] Add a production smoke check after Vercel deployment.

## Phase 4: Complete JQ

- [x] Run synchronous JQ calls in-app with `eth_call`.
- [x] Decode every supported output type, including Ritual's string indirection.
- [x] Present empty and invalid outputs clearly without requiring wallet gas.

## Phase 5: Complete LLM

- [x] Verify the active LLM executor capability mapping.
- [x] Add and deploy an LLM consumer with wallet submission.
- [x] Decode LLM `spcCalls` output and display completion, metadata, and errors.
- [x] Treat streaming as a separate capability and keep it out of the verified non-streaming path.

Live verification note (2026-07-12): capability `1` and executor `0xb42e...c91b` were accepted and settled through the deployed consumer. The credential-free smoke call reached the executor but returned a registry certificate-hash infrastructure error, so a successful model completion still depends on Ritual restoring that executor path.

## Phase 6: Complete Agent

- [x] Verify the deployed SovereignAgentFactory and its Scheduler, RitualWallet, registry, and AsyncDelivery wiring.
- [x] Deploy a deterministic SovereignAgentHarness through the factory and use it as the authenticated callback target.
- [x] Track AsyncJobTracker lifecycle events and sender lock state.
- [x] Present submitted, processing, delivery, callback, failed, and expired states.

Live verification note (2026-07-13): factory wiring matched Ritual's published system contracts. Harness `0x8067...E2Fe` was deployed deterministically in transaction `0x5853...a887`; its owner and initial lifecycle getters were read back from chain. Agent launch remains an explicit owner-wallet action because it transfers scheduler funding and starts recurring calls.

## Phase 7: Complete Scheduler

- [x] Deploy a Scheduler-compatible consumer and configure contract-owned escrow.
- [x] Schedule a real supported JQ callback from the studio.
- [x] Track execution IDs, future calls, skips, failures, expiry, and cancellation.

Live verification note (2026-07-13): `ScheduledJqConsumer` was deployed at `0x7243...A668`. Atomic fund-and-schedule transaction `0x36be...6a6f` created call `3146449`; Ritual executed it at block `45,372,505`, and the consumer recorded one completed callback with decoded `uint256` result `1979`. The studio reconciles recent Scheduler events, synthetic execution transactions, and consumer state so lifecycle evidence remains useful after the RPC log-retention window.

## Phase 8: Release Hardening

- [x] Label recipes honestly as public, degraded, or owner-only based on verified behavior.
- [x] Document MetaMask as the supported Ritual submission wallet and explain Rabby's custom-network limitation.
- [x] Complete accessibility, responsive, error-state, and production verification passes.
- [x] Publish a step-by-step test guide for every recipe.

Release verification note (2026-07-13): Vitest, Foundry, and twelve desktop/mobile Playwright cases pass. Chrome DevTools reported no console issues; Lighthouse scored accessibility and best practices at 100 on desktop and mobile. The production smoke test verifies all five deployed consumer, factory, and harness addresses in the Vercel bundle plus the standalone FAQ route.

## Phase 9: Per-Wallet Scheduled JQ

- [x] Refactor the Scheduler consumer core for explicit owner assignment without changing the legacy deployment.
- [x] Deploy a deterministic one-consumer-per-wallet factory on Ritual testnet.
- [x] Discover or create the connected wallet's consumer directly from the studio.
- [x] Scope Scheduler transactions, lifecycle recovery, and local origin evidence to the discovered consumer.
- [x] Verify a factory child with a real atomic fund-and-schedule execution.

Live verification note (2026-07-13): factory `0x705e...548b` created child `0x43be...33e4` for the deployer. Transaction `0xa2d4...bf86` funded the child and created call `3147825`; Ritual executed it at block `45,403,040` in synthetic Scheduler transaction `0x6823...e718b`. The child reached completed state and stored decoded result `1979`. Twelve desktop/mobile Playwright cases now cover existing and first-time Scheduled JQ wallets.
