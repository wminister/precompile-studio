// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRitualWalletScheduler {
    function deposit(uint256 lockDuration) external payable;
    function balanceOf(address account) external view returns (uint256);
    function withdraw(uint256 amount) external;
}

interface IRitualScheduler {
    function schedule(
        bytes calldata data,
        uint32 gasLimit,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId);

    function cancel(uint256 callId) external;
    function getCallState(uint256 callId) external view returns (uint8 state);
}

/// @notice Contract-owned recurring JQ execution for Precompile Studio.
/// @dev The consumer is both Scheduler caller and payer, so no EOA scheduler
///      approval is required. The Scheduler injects executionIndex at runtime.
contract ScheduledJqConsumer {
    address internal constant JQ_PRECOMPILE = 0x0000000000000000000000000000000000000803;
    address internal constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    uint256 public constant SCHEDULER_RESERVE = 0.01 ether;

    IRitualScheduler public immutable scheduler;
    address public immutable owner;

    uint256 public activeScheduleId;
    uint256 public lastScheduleId;
    uint256 public executionCount;
    uint256 public scheduleExecutionOffset;
    uint256 public lastExecutionIndex;
    uint32 public activeNumCalls;
    uint8 public localScheduleState = 2;
    bytes public lastResult;

    event ScheduleCreated(uint256 indexed callId, uint32 startBlock, uint32 frequency, uint32 numCalls, uint32 ttl);
    event ScheduleCancelled(uint256 indexed callId);
    event TransformExecuted(uint256 indexed executionIndex, bytes result);
    event ConsumerFunded(uint256 amount, uint256 lockDuration);
    event ConsumerWithdrawal(uint256 amount);

    error NotOwner();
    error NotScheduler();
    error InvalidSchedule();
    error ScheduleStillActive();
    error NoActiveSchedule();
    error JqCallFailed();
    error InsufficientConsumerFunds(uint256 required, uint256 available);
    error TransferFailed();

    constructor(address schedulerAddress) {
        if (schedulerAddress == address(0)) revert InvalidSchedule();
        owner = msg.sender;
        scheduler = IRitualScheduler(schedulerAddress);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyScheduler() {
        if (msg.sender != address(scheduler)) revert NotScheduler();
        _;
    }

    receive() external payable {}

    function fund(uint256 lockDuration) external payable onlyOwner {
        _fund(lockDuration);
    }

    function _fund(uint256 lockDuration) internal {
        if (msg.value == 0 || lockDuration == 0) revert InvalidSchedule();
        IRitualWalletScheduler(RITUAL_WALLET).deposit{value: msg.value}(lockDuration);
        emit ConsumerFunded(msg.value, lockDuration);
    }

    function consumerBalance() public view returns (uint256) {
        return IRitualWalletScheduler(RITUAL_WALLET).balanceOf(address(this));
    }

    function withdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidSchedule();
        IRitualWalletScheduler(RITUAL_WALLET).withdraw(amount);
        (bool sent,) = payable(owner).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit ConsumerWithdrawal(amount);
    }

    function requiredWalletBalance(uint32 gasLimit, uint32 numCalls, uint256 maxFeePerGas, uint256 value)
        public
        pure
        returns (uint256)
    {
        return SCHEDULER_RESERVE + (uint256(gasLimit) * maxFeePerGas + value) * uint256(numCalls);
    }

    function scheduleTransform(
        string calldata jqFilter,
        string calldata inputJson,
        uint8 outputType,
        uint32 frequency,
        uint32 numCalls,
        uint32 gasLimit,
        uint32 ttl,
        uint256 maxFeePerGas
    ) external onlyOwner returns (uint256 callId) {
        return _scheduleTransform(jqFilter, inputJson, outputType, frequency, numCalls, gasLimit, ttl, maxFeePerGas);
    }

    function fundAndSchedule(
        string calldata jqFilter,
        string calldata inputJson,
        uint8 outputType,
        uint32 frequency,
        uint32 numCalls,
        uint32 gasLimit,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 lockDuration
    ) external payable onlyOwner returns (uint256 callId) {
        _fund(lockDuration);
        return _scheduleTransform(jqFilter, inputJson, outputType, frequency, numCalls, gasLimit, ttl, maxFeePerGas);
    }

    function _scheduleTransform(
        string calldata jqFilter,
        string calldata inputJson,
        uint8 outputType,
        uint32 frequency,
        uint32 numCalls,
        uint32 gasLimit,
        uint32 ttl,
        uint256 maxFeePerGas
    ) internal returns (uint256 callId) {
        if (
            bytes(jqFilter).length == 0 || bytes(inputJson).length == 0 || frequency == 0 || numCalls == 0
                || gasLimit == 0 || ttl > 500 || maxFeePerGas == 0 || uint256(frequency) * uint256(numCalls) > 10_000
        ) revert InvalidSchedule();
        if (activeScheduleId != 0 && scheduler.getCallState(activeScheduleId) < 2) {
            revert ScheduleStillActive();
        }
        uint256 required = requiredWalletBalance(gasLimit, numCalls, maxFeePerGas, 0);
        uint256 available = consumerBalance();
        if (available < required) revert InsufficientConsumerFunds(required, available);

        bytes memory data =
            abi.encodeWithSelector(this.executeTransform.selector, uint256(0), jqFilter, inputJson, outputType);
        uint32 startBlock = uint32(block.number) + frequency;
        callId =
            scheduler.schedule(data, gasLimit, startBlock, numCalls, frequency, ttl, maxFeePerGas, 0, 0, address(this));
        activeScheduleId = callId;
        lastScheduleId = callId;
        activeNumCalls = numCalls;
        scheduleExecutionOffset = executionCount;
        localScheduleState = 0;
        emit ScheduleCreated(callId, startBlock, frequency, numCalls, ttl);
    }

    function executeTransform(
        uint256 executionIndex,
        string calldata jqFilter,
        string calldata inputJson,
        uint8 outputType
    ) external onlyScheduler {
        (bool success, bytes memory result) = JQ_PRECOMPILE.call(abi.encode(jqFilter, inputJson, outputType));
        if (!success) revert JqCallFailed();

        lastExecutionIndex = executionIndex;
        lastResult = result;
        unchecked {
            executionCount++;
        }
        if (executionCount - scheduleExecutionOffset >= activeNumCalls) {
            activeScheduleId = 0;
            localScheduleState = 2;
        }
        emit TransformExecuted(executionIndex, result);
    }

    function cancelSchedule() external onlyOwner {
        uint256 callId = activeScheduleId;
        if (callId == 0) revert NoActiveSchedule();
        scheduler.cancel(callId);
        activeScheduleId = 0;
        localScheduleState = 3;
        emit ScheduleCancelled(callId);
    }

    function activeScheduleState() external view returns (uint8) {
        uint256 callId = activeScheduleId;
        if (callId == 0) return localScheduleState;
        try scheduler.getCallState(callId) returns (uint8 state) {
            return state;
        } catch {
            return 4;
        }
    }
}
