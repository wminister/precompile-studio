# Sovereign Agent One-Shot Verification

Precompile Studio must not describe Agent execution as fully verified until every
gate below passes. A bounded live-test action may be exposed after the contract,
deployment, deterministic consumer, transaction preflight, and maximum-debit
gates pass; the remaining gates record the result of that explicitly approved
test.

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
- [x] Factory deployed to Ritual testnet.
- [x] Deployment bytecode and constructor Scheduler address verified.
- [x] A wallet child is created without funding an Agent execution.
- [x] A read-only preflight quotes the complete maximum wallet debit.
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

## Verified Factory Deployment

- Factory: `0xAE2D6BD1C04641A0Dd5453BcE699a7e7877D0Ef7`
- Transaction: `0x1043aaa17bf1090743221613a03b34520c3e603ba179ccfba51e28aa561818a3`
- Block: `51095832`
- Scheduler immutable: `0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B`
- Actual network cost: `0.002576323018034261 RITUAL`

The deployed runtime length matches the Solidity artifact. All non-immutable
runtime bytes match exactly, and the three immutable slots resolve through
`scheduler()` to the Scheduler address above. The factory deployment itself did
not create a child or fund an Agent execution.

## Verified Deployer Consumer

- Consumer: `0x1f6f1102D533bf78d61C4ad5CC3ECD4D4b2Ba0FC`
- Owner: `0xE74600CB53B65F475ef8032EEc68AFc32edfDE6E`
- Transaction: `0xe49ead931a5da9881c6ffa776415af1b89a0d7362283f567132fd66324295182`
- Block: `51155175`
- Gas used: `1951558`
- Actual network cost: `0.000195155813660906 RITUAL`

The consumer was created with zero transaction value. Its RitualWallet balance,
active schedule, execution count, job id, and result were all zero after
deployment. The runtime bytecode matches the local artifact after resolving its
immutable constructor values.
