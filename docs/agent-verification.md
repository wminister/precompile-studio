# Sovereign Agent One-Shot Verification

Precompile Studio must not expose another paid Agent launch until every gate below passes.

## Why The Factory Harness Is Blocked

Ritual's official `SovereignAgentHarness` is a rolling production harness. A window configured with one call still reaches its rollover threshold on that call and can schedule a successor window. It is therefore not a bounded one-shot test.

The legacy fork verifier only proved that `configureFundAndStart` succeeded and produced an active Scheduler call. It did not prove Scheduler dispatch, Agent job creation, TEE execution, callback delivery, terminal state, or total cost.

## Replacement

`SovereignAgentOneShotConsumer` is a wallet-owned Scheduler consumer that:

1. schedules `numCalls = 1`;
2. clears its active schedule before calling precompile `0x080C`;
3. rejects a second execution;
4. contains no successor scheduling code;
5. stores final results only when called by Ritual AsyncDelivery;
6. isolates funds in the consumer's RitualWallet account;
7. permits only the owner to cancel and withdraw.

`SovereignAgentOneShotConsumerFactory` creates one deterministic consumer for each wallet.

## Release Gates

- [x] Contract compiles with Solidity 0.8.20.
- [x] Unit test proves Scheduler `numCalls` is exactly one.
- [x] Unit test proves a second invocation reverts.
- [x] Unit test proves no successor schedule is created.
- [x] Unit test proves only Scheduler can invoke the Agent.
- [x] Unit test proves only AsyncDelivery can deliver the result.
- [x] Unit tests cover funding, cancellation, and owner withdrawal.
- [ ] Factory deployed to Ritual testnet.
- [ ] Deployment bytecode and constructor Scheduler address verified.
- [ ] A wallet child is created without funding an Agent execution.
- [ ] A read-only preflight quotes the complete maximum wallet debit.
- [ ] One explicitly approved live test uses a fixed consumer deposit.
- [ ] The Scheduler dispatch transaction is observed.
- [ ] `JobAdded`, phase-one settlement, AsyncDelivery, and stored callback are observed.
- [ ] The consumer reports exactly one execution and no active successor schedule.
- [ ] Remaining escrow and unlock height are shown accurately.
- [ ] The production UI is switched from legacy harness history to the verified consumer.

## Spending Rule

Deployment and live smoke testing are separate actions. Neither is automatic. Before a live smoke test, the UI and operator must show:

- the exact value transferred into the consumer;
- the maximum outer transaction gas;
- the Scheduler callback budget;
- that executor pricing is not yet quoted by the Studio;
- the escrow lock and withdrawal conditions.

No live transaction should be submitted without the wallet owner approving that specific maximum.
