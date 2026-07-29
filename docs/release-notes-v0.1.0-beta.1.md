# Precompile Studio 0.1.0-beta.1

Precompile Studio is a Ritual testnet beta for composing, checking, and tracing precompile calls before signing.

## Included

- HTTP composer, verified consumer submission, and decoded response history
- Wallet-free typed JQ execution
- Wallet-owned Scheduled JQ creation, funding, lifecycle tracking, cancellation, and escrow recovery
- MetaMask reconnection and Ritual chain add/switch flow
- Local recipe presets, consumer and executor records, and portable HTTP trace history
- Standalone FAQ and button-by-button test guide

## Known limitations

- Users pay their own Ritual testnet gas and protocol fees.
- LLM is marked degraded because Ritual's current executor route may return an infrastructure error instead of a completion.
- Agent is inspection-only. New paid launches are paused until a complete request, callback, and reserve-recovery cycle is verified against a reliably quoted route.
- MetaMask is the supported transaction wallet. Rabby can connect for read access but cannot currently submit Ritual's supported custom transaction form.

## Verification

The release gate includes TypeScript and Vite production builds, Vitest unit coverage, Foundry consumer tests, desktop and mobile Playwright coverage, and a post-deploy production smoke test.
