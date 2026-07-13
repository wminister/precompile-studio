// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ScheduledJqConsumer} from "../contracts/ScheduledJqConsumer.sol";

interface SchedulerVm {
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function mockCallRevert(address callee, bytes calldata data, bytes calldata revertData) external;
    function deal(address account, uint256 balance) external;
}

contract SchedulerMock {
    bytes public scheduledData;
    address public payer;
    uint32 public startBlock;
    uint32 public numCalls;
    uint32 public frequency;
    uint32 public gasLimit;
    uint32 public ttl;
    uint256 public maxFeePerGas;
    uint256 public cancelledCallId;
    uint8 public state;

    function schedule(
        bytes calldata data,
        uint32 callbackGas,
        uint32 callbackStartBlock,
        uint32 callbackNumCalls,
        uint32 callbackFrequency,
        uint32 callbackTtl,
        uint256 callbackMaxFeePerGas,
        uint256,
        uint256,
        address callbackPayer
    ) external returns (uint256 callId) {
        scheduledData = data;
        gasLimit = callbackGas;
        startBlock = callbackStartBlock;
        numCalls = callbackNumCalls;
        frequency = callbackFrequency;
        ttl = callbackTtl;
        maxFeePerGas = callbackMaxFeePerGas;
        payer = callbackPayer;
        state = 0;
        return 7;
    }

    function cancel(uint256 callId) external {
        cancelledCallId = callId;
        state = 3;
    }

    function getCallState(uint256) external view returns (uint8) {
        return state;
    }

    function trigger(
        ScheduledJqConsumer consumer,
        uint256 executionIndex,
        string calldata jqFilter,
        string calldata inputJson,
        uint8 outputType
    ) external {
        consumer.executeTransform(executionIndex, jqFilter, inputJson, outputType);
    }
}

contract ScheduledJqConsumerTest {
    SchedulerVm private constant vm = SchedulerVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant JQ_PRECOMPILE = 0x0000000000000000000000000000000000000803;
    address private constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    SchedulerMock private scheduler;
    ScheduledJqConsumer private consumer;

    receive() external payable {}

    function setUp() public {
        scheduler = new SchedulerMock();
        consumer = new ScheduledJqConsumer(address(scheduler));
        vm.mockCall(
            RITUAL_WALLET, abi.encodeWithSignature("balanceOf(address)", address(consumer)), abi.encode(1 ether)
        );
    }

    function testFundsConsumerEscrowInSeparateTransaction() public {
        vm.deal(address(this), 1 ether);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSignature("deposit(uint256)", 50_000), bytes(""));
        consumer.fund{value: 0.01 ether}(50_000);
    }

    function testFundsAndSchedulesAtomically() public {
        vm.deal(address(this), 1 ether);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSignature("deposit(uint256)", 50_000), bytes(""));

        uint256 callId = consumer.fundAndSchedule{value: 0.0104 ether}(
            ".data.price", '{"data":{"price":1979}}', 1, 20, 1, 200_000, 100, 2 gwei, 50_000
        );

        require(callId == 7 && consumer.activeScheduleId() == 7, "atomic schedule");
    }

    function testWithdrawsUnlockedConsumerEscrowToOwner() public {
        uint256 amount = 0.01 ether;
        vm.deal(address(consumer), amount);
        vm.mockCall(RITUAL_WALLET, abi.encodeWithSignature("withdraw(uint256)", amount), bytes(""));
        uint256 ownerBalance = address(this).balance;

        consumer.withdraw(amount);

        require(address(this).balance == ownerBalance + amount, "owner receives withdrawal");
    }

    function testCreatesContractPaidRecurringSchedule() public {
        uint256 callId =
            consumer.scheduleTransform(".data.price", '{"data":{"price":1979}}', 1, 20, 3, 300_000, 100, 20 gwei);

        require(callId == 7 && consumer.activeScheduleId() == 7, "call id");
        require(consumer.lastScheduleId() == 7, "last call id");
        require(scheduler.payer() == address(consumer), "payer");
        require(scheduler.frequency() == 20 && scheduler.numCalls() == 3, "schedule");
        require(scheduler.ttl() == 100 && scheduler.gasLimit() == 300_000, "limits");
        bytes memory data = scheduler.scheduledData();
        require(bytes4(data) == consumer.executeTransform.selector, "selector");
        uint256 placeholder;
        assembly {
            placeholder := mload(add(data, 36))
        }
        require(placeholder == 0, "execution placeholder");
    }

    function testExecutesJqOnlyThroughScheduler() public {
        string memory filter = ".data.price";
        string memory inputJson = '{"data":{"price":1979}}';
        bytes memory jqInput = abi.encode(filter, inputJson, uint8(1));
        bytes memory jqResult = abi.encode(uint256(1979));
        vm.mockCall(JQ_PRECOMPILE, jqInput, jqResult);

        scheduler.trigger(consumer, 2, filter, inputJson, 1);
        require(consumer.executionCount() == 1, "count");
        require(consumer.lastExecutionIndex() == 2, "index");
        require(keccak256(consumer.lastResult()) == keccak256(jqResult), "result");
        require(consumer.activeScheduleId() == 0, "completed schedule clears active id");
        require(consumer.activeScheduleState() == 2, "completed state");

        (bool ok,) = address(consumer).call(abi.encodeCall(consumer.executeTransform, (3, filter, inputJson, 1)));
        require(!ok, "direct callback should fail");
    }

    function testCancelsActiveSchedule() public {
        consumer.scheduleTransform(".", "{}", 2, 10, 1, 200_000, 100, 20 gwei);
        consumer.cancelSchedule();
        require(consumer.activeScheduleId() == 0, "active id");
        require(scheduler.cancelledCallId() == 7, "cancel id");
        require(consumer.activeScheduleState() == 3, "cancelled state");
    }

    function testRejectsInvalidLifespan() public {
        (bool ok,) = address(consumer)
            .call(abi.encodeCall(consumer.scheduleTransform, (".", "{}", 2, 2_001, 5, 200_000, 100, 20 gwei)));
        require(!ok, "invalid lifespan");
    }

    function testRequiresReservePlusExecutionBudget() public {
        uint256 required = consumer.requiredWalletBalance(200_000, 2, 2 gwei, 0);
        require(required == 0.0108 ether, "required balance");
        vm.mockCall(
            RITUAL_WALLET, abi.encodeWithSignature("balanceOf(address)", address(consumer)), abi.encode(required - 1)
        );

        (bool ok,) = address(consumer)
            .call(abi.encodeCall(consumer.scheduleTransform, (".", "{}", 2, 20, 2, 200_000, 100, 2 gwei)));
        require(!ok, "underfunded schedule should fail locally");
    }
}
