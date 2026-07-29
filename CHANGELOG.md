# Changelog

## 0.1.0-beta.1 - 2026-07-29

### Available

- Compose, submit, and trace HTTP precompile calls through the verified consumer.
- Run typed JQ queries without a wallet or gas.
- Create wallet-owned Scheduled JQ consumers and inspect their onchain lifecycle.
- Reconnect authorized MetaMask sessions and add or switch to Ritual testnet.
- Save local presets, consumers, executors, and HTTP trace history.

### Limited

- LLM submission is implemented, but Ritual's current executor route is degraded and may return infrastructure errors instead of a completion.
- Sovereign Agent composition, registry inspection, prior history, and escrow recovery remain available, but new paid Agent launches are paused.
- MetaMask is the supported transaction wallet. Rabby can read state but cannot currently submit Ritual's supported custom transaction form.

### Cost model

- Visitors pay their own Ritual testnet gas and protocol fees.
- Precompile Studio does not sponsor, relay, or automatically send transactions.
