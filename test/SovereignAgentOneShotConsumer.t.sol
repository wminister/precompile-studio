// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SovereignAgentOneShotConsumer} from "../contracts/SovereignAgentOneShotConsumer.sol";

interface AgentVm {
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
}

contract AgentSchedulerMock {
    bytes public scheduledData;
    address public payer;
    uint32 public gasLimit;
    uint32 public startBlock;
    uint32 public numCalls;
    uint32 public frequency;
    uint32 public ttl;
    uint256 public maxFeePerGas;
    uint256 public maxPriorityFeePerGas;
    uint256 public scheduledValue;
    uint256 public scheduleCount;
    uint256 public cancelledCallId;
    uint8 public state;

    function schedule(
        bytes calldata data,
        uint32 callbackGasLimit,
        uint32 callbackStartBlock,
        uint32 callbackNumCalls,
        uint32 callbackFrequency,
        uint32 callbackTtl,
        uint256 callbackMaxFeePerGas,
        uint256 callbackMaxPriorityFeePerGas,
        uint256 callbackValue,
        address callbackPayer
    ) external returns (uint256 callId) {
        scheduledData = data;
        gasLimit = callbackGasLimit;
        startBlock = callbackStartBlock;
        numCalls = callbackNumCalls;
        frequency = callbackFrequency;
        ttl = callbackTtl;
        maxFeePerGas = callbackMaxFeePerGas;
        maxPriorityFeePerGas = callbackMaxPriorityFeePerGas;
        scheduledValue = callbackValue;
        payer = callbackPayer;
        scheduleCount++;
        state = 0;
        return 41;
    }

    function cancel(uint256 callId) external {
        cancelledCallId = callId;
        state = 3;
    }

    function getCallState(uint256) external view returns (uint8) {
        return state;
    }

    function trigger(SovereignAgentOneShotConsumer consumer) external returns (bool ok) {
        (ok,) = address(consumer).call(scheduledData);
    }

    function triggerData(SovereignAgentOneShotConsumer consumer, bytes calldata data) external returns (bool ok) {
        (ok,) = address(consumer).call(data);
    }
}

contract SovereignAgentOneShotConsumerTest {
    AgentVm private constant vm = AgentVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant AGENT_PRECOMPILE = 0x000000000000000000000000000000000000080C;
    address private constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address private constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    AgentSchedulerMock private scheduler;
    SovereignAgentOneShotConsumer private consumer;

    receive() external payable {}

    function setUp() public {
        scheduler = new AgentSchedulerMock();
        consumer = new SovereignAgentOneShotConsumer(address(scheduler));
        vm.mockCall(
            RITUAL_WALLET, abi.encodeWithSignature("balanceOf(address)", address(consumer)), abi.encode(1 ether)
        );
    }

    function testSchedulesExactlyOneInvocation() public {
        bytes memory agentInput = hex"12345678aabbccdd";
        uint256 callId = consumer.scheduleAgent(agentInput, 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);

        require(callId == 41 && consumer.activeScheduleId() == 41, "call id");
        require(scheduler.scheduleCount() == 1, "one schedule");
        require(scheduler.numCalls() == 1, "one scheduler callback");
        require(scheduler.payer() == address(consumer), "isolated payer");
        require(scheduler.frequency() == 2_000, "frequency");
        require(scheduler.gasLimit() == 500_000 && scheduler.ttl() == 500, "callback bounds");
        require(scheduler.maxFeePerGas() == 20 gwei, "max fee");
        require(scheduler.maxPriorityFeePerGas() == 1 gwei, "priority fee");
        require(bytes4(scheduler.scheduledData()) == consumer.executeAgent.selector, "selector");
    }

    function testExecutesOnceAndCannotCreateSuccessor() public {
        bytes memory agentInput = hex"12345678aabbccdd";
        bytes memory phaseOneOutput = abi.encode(bytes32(uint256(99)));
        vm.mockCall(AGENT_PRECOMPILE, agentInput, phaseOneOutput);
        consumer.scheduleAgent(agentInput, 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);

        require(scheduler.trigger(consumer), "first execution");
        require(consumer.executionCount() == 1, "one invocation");
        require(consumer.activeScheduleId() == 0, "schedule cleared");
        require(consumer.activeScheduleState() == 2, "complete");
        require(keccak256(consumer.lastPhaseOneOutput()) == keccak256(phaseOneOutput), "phase one output");
        require(scheduler.scheduleCount() == 1, "no successor schedule");

        require(!scheduler.trigger(consumer), "second execution rejected");
        require(consumer.executionCount() == 1, "still one invocation");
        require(scheduler.scheduleCount() == 1, "still no successor");
    }

    function testAcceptsResultOnlyFromAsyncDelivery() public {
        bytes32 jobId = keccak256("agent-job");
        bytes memory result = abi.encode("Ritual result");

        (bool directOk,) = address(consumer).call(abi.encodeCall(consumer.onSovereignAgentResult, (jobId, result)));
        require(!directOk, "untrusted callback rejected");

        vm.prank(ASYNC_DELIVERY);
        consumer.onSovereignAgentResult(jobId, result);
        require(consumer.lastJobId() == jobId, "job stored");
        require(keccak256(consumer.lastResult()) == keccak256(result), "result stored");
    }

    function testFundsAndSchedulesAtomically() public {
        vm.deal(address(this), 1 ether);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSignature("deposit(uint256)", 100_000), bytes(""));

        uint256 callId = consumer.fundAndSchedule{value: 0.02 ether}(
            hex"12345678", 2_000, 500_000, 500, 20 gwei, 1 gwei, 0, 100_000
        );
        require(callId == 41, "scheduled");
    }

    function testRequiresSchedulerReserveAndCallbackBudget() public {
        uint256 required = consumer.requiredSchedulerBalance(500_000, 20 gwei, 0);
        require(required == 0.02 ether, "scheduler requirement");
        vm.mockCall(
            RITUAL_WALLET, abi.encodeWithSignature("balanceOf(address)", address(consumer)), abi.encode(required - 1)
        );

        (bool ok,) = address(consumer)
            .call(abi.encodeCall(consumer.scheduleAgent, (hex"12345678", 2_000, 500_000, 500, 20 gwei, 1 gwei, 0)));
        require(!ok, "underfunded callback rejected");
    }

    function testOwnerCanWithdrawUnlockedConsumerFunds() public {
        uint256 amount = 0.01 ether;
        vm.deal(address(consumer), amount);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSignature("withdraw(uint256)", amount), bytes(""));
        uint256 beforeBalance = address(this).balance;

        consumer.withdraw(amount);

        require(address(this).balance == beforeBalance + amount, "owner receives funds");
    }

    function testOnlySchedulerCanExecute() public {
        bytes memory agentInput = hex"12345678";
        consumer.scheduleAgent(agentInput, 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);

        (bool ok,) = address(consumer)
            .call(abi.encodeCall(consumer.executeAgent, (0, consumer.activeScheduleNonce(), agentInput)));
        require(!ok, "direct execution rejected");
    }

    function testStaleCallbackCannotConsumeANewerSchedule() public {
        bytes memory agentInput = hex"12345678";
        bytes memory phaseOneOutput = abi.encode(bytes32(uint256(77)));
        vm.mockCall(AGENT_PRECOMPILE, agentInput, phaseOneOutput);

        consumer.scheduleAgent(agentInput, 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);
        bytes memory staleData = scheduler.scheduledData();
        consumer.cancelSchedule();

        consumer.scheduleAgent(agentInput, 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);
        require(!scheduler.triggerData(consumer, staleData), "stale callback rejected");
        require(consumer.activeScheduleId() == 41, "new schedule preserved");
        require(consumer.executionCount() == 0, "nothing executed");

        require(scheduler.trigger(consumer), "new callback accepted");
        require(consumer.executionCount() == 1, "new schedule executed once");
    }

    function testCancelsPendingSchedule() public {
        consumer.scheduleAgent(hex"12345678", 2_000, 500_000, 500, 20 gwei, 1 gwei, 0);
        consumer.cancelSchedule();

        require(consumer.activeScheduleId() == 0, "active id cleared");
        require(consumer.activeScheduleState() == 3, "cancelled");
        require(scheduler.cancelledCallId() == 41, "scheduler cancelled");
    }
}
