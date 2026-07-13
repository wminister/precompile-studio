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

- [ ] Verify the deployed SovereignAgentFactory and its Scheduler, RitualWallet, registry, and AsyncDelivery wiring.
- [ ] Deploy a deterministic SovereignAgentHarness through the factory and use it as the authenticated callback target.
- [ ] Track AsyncJobTracker lifecycle events and sender lock state.
- [ ] Present submitted, processing, delivery, callback, failed, and expired states.

## Phase 7: Complete Scheduler

- [ ] Deploy a Scheduler-compatible consumer and configure approvals.
- [ ] Schedule a real supported callback from the studio.
- [ ] Track execution IDs, future calls, skips, failures, expiry, and cancellation.

## Phase 8: Release Hardening

- [ ] Label recipes honestly as live or composer-only until their full paths are verified.
- [ ] Document MetaMask as the supported Ritual submission wallet and explain Rabby's custom-network limitation.
- [ ] Complete accessibility, responsive, error-state, and production verification passes.
- [ ] Publish a step-by-step test guide for every live recipe.
