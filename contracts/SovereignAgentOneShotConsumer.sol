// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRitualWalletAgent {
    function deposit(uint256 lockDuration) external payable;
    function balanceOf(address account) external view returns (uint256);
    function withdraw(uint256 amount) external;
}

interface IRitualSchedulerAgent {
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

/// @notice A wallet-owned, single-invocation Sovereign Agent consumer.
/// @dev Unlike Ritual's rolling factory harness, this consumer schedules one
///      callback and has no code path that can create a successor schedule.
abstract contract SovereignAgentOneShotConsumerCore {
    address internal constant SOVEREIGN_AGENT_PRECOMPILE = 0x000000000000000000000000000000000000080C;
    address internal constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address internal constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    uint256 public constant SCHEDULER_RESERVE = 0.01 ether;

    IRitualSchedulerAgent public immutable scheduler;
    address public immutable owner;

    uint256 public activeScheduleId;
    uint256 public lastScheduleId;
    uint256 public executionCount;
    uint256 public lastExecutionIndex;
    uint256 public scheduleNonce;
    uint256 public activeScheduleNonce;
    uint8 public localScheduleState = 2;
    bytes public lastPhaseOneOutput;
    bytes32 public lastJobId;
    bytes public lastResult;

    struct ScheduleRequest {
        uint32 frequency;
        uint32 gasLimit;
        uint32 ttl;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        uint256 value;
    }

    event AgentScheduled(uint256 indexed callId, uint32 startBlock, uint32 ttl);
    event AgentInvoked(uint256 indexed executionIndex, bytes phaseOneOutput);
    event AgentResultDelivered(bytes32 indexed jobId, bytes result);
    event ScheduleCancelled(uint256 indexed callId);
    event ConsumerFunded(uint256 amount, uint256 lockDuration);
    event ConsumerWithdrawal(uint256 amount);

    error NotOwner();
    error NotScheduler();
    error NotAsyncDelivery();
    error InvalidConfiguration();
    error ScheduleStillActive();
    error NoActiveSchedule();
    error StaleSchedule();
    error AgentCallFailed();
    error InsufficientConsumerFunds(uint256 required, uint256 available);
    error TransferFailed();

    constructor(address schedulerAddress, address initialOwner) {
        if (schedulerAddress == address(0) || initialOwner == address(0)) revert InvalidConfiguration();
        scheduler = IRitualSchedulerAgent(schedulerAddress);
        owner = initialOwner;
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
        if (msg.value == 0 || lockDuration == 0) revert InvalidConfiguration();
        IRitualWalletAgent(RITUAL_WALLET).deposit{value: msg.value}(lockDuration);
        emit ConsumerFunded(msg.value, lockDuration);
    }

    function consumerBalance() public view returns (uint256) {
        return IRitualWalletAgent(RITUAL_WALLET).balanceOf(address(this));
    }

    function withdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidConfiguration();
        IRitualWalletAgent(RITUAL_WALLET).withdraw(amount);
        (bool sent,) = payable(owner).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit ConsumerWithdrawal(amount);
    }

    /// @notice Minimum balance reserved for the Scheduler callback itself.
    /// @dev Sovereign Agent execution fees are separate and executor-dependent.
    function requiredSchedulerBalance(uint32 gasLimit, uint256 maxFeePerGas, uint256 value)
        public
        pure
        returns (uint256)
    {
        return SCHEDULER_RESERVE + uint256(gasLimit) * maxFeePerGas + value;
    }

    function scheduleAgent(
        bytes calldata agentInput,
        uint32 frequency,
        uint32 gasLimit,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value
    ) external onlyOwner returns (uint256 callId) {
        ScheduleRequest memory request =
            ScheduleRequest(frequency, gasLimit, ttl, maxFeePerGas, maxPriorityFeePerGas, value);
        return _scheduleAgent(agentInput, request);
    }

    function fundAndSchedule(
        bytes calldata agentInput,
        uint32 frequency,
        uint32 gasLimit,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        uint256 lockDuration
    ) external payable onlyOwner returns (uint256 callId) {
        _fund(lockDuration);
        ScheduleRequest memory request =
            ScheduleRequest(frequency, gasLimit, ttl, maxFeePerGas, maxPriorityFeePerGas, value);
        return _scheduleAgent(agentInput, request);
    }

    function _scheduleAgent(bytes calldata agentInput, ScheduleRequest memory request)
        internal
        returns (uint256 callId)
    {
        if (
            agentInput.length == 0 || request.frequency == 0 || request.gasLimit == 0 || request.ttl == 0
                || request.ttl > 500 || request.maxFeePerGas == 0 || request.maxPriorityFeePerGas > request.maxFeePerGas
        ) revert InvalidConfiguration();
        if (activeScheduleId != 0 && scheduler.getCallState(activeScheduleId) < 2) {
            revert ScheduleStillActive();
        }

        uint256 required = requiredSchedulerBalance(request.gasLimit, request.maxFeePerGas, request.value);
        uint256 available = consumerBalance();
        if (available < required) revert InsufficientConsumerFunds(required, available);

        uint256 nonce;
        unchecked {
            nonce = ++scheduleNonce;
        }
        bytes memory data = abi.encodeWithSelector(this.executeAgent.selector, uint256(0), nonce, agentInput);
        uint32 startBlock = uint32(block.number) + request.frequency;
        callId = _createSchedule(data, startBlock, request);
        activeScheduleId = callId;
        activeScheduleNonce = nonce;
        lastScheduleId = callId;
        localScheduleState = 0;
        emit AgentScheduled(callId, startBlock, request.ttl);
    }

    function _createSchedule(bytes memory data, uint32 startBlock, ScheduleRequest memory request)
        private
        returns (uint256)
    {
        return scheduler.schedule(
            data,
            request.gasLimit,
            startBlock,
            1,
            request.frequency,
            request.ttl,
            request.maxFeePerGas,
            request.maxPriorityFeePerGas,
            request.value,
            address(this)
        );
    }

    function executeAgent(uint256 executionIndex, uint256 nonce, bytes calldata agentInput) external onlyScheduler {
        if (activeScheduleId == 0) revert NoActiveSchedule();
        if (nonce != activeScheduleNonce) revert StaleSchedule();

        // Clear first so neither the Scheduler nor the precompile can reenter a
        // second invocation for this schedule.
        activeScheduleId = 0;
        activeScheduleNonce = 0;
        localScheduleState = 2;

        (bool success, bytes memory output) = SOVEREIGN_AGENT_PRECOMPILE.call(agentInput);
        if (!success) revert AgentCallFailed();

        lastExecutionIndex = executionIndex;
        lastPhaseOneOutput = output;
        unchecked {
            executionCount++;
        }
        emit AgentInvoked(executionIndex, output);
    }

    function onSovereignAgentResult(bytes32 jobId, bytes calldata result) external {
        if (msg.sender != ASYNC_DELIVERY) revert NotAsyncDelivery();
        lastJobId = jobId;
        lastResult = result;
        emit AgentResultDelivered(jobId, result);
    }

    function cancelSchedule() external onlyOwner {
        uint256 callId = activeScheduleId;
        if (callId == 0) revert NoActiveSchedule();
        scheduler.cancel(callId);
        activeScheduleId = 0;
        activeScheduleNonce = 0;
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

contract SovereignAgentOneShotConsumer is SovereignAgentOneShotConsumerCore {
    constructor(address schedulerAddress) SovereignAgentOneShotConsumerCore(schedulerAddress, msg.sender) {}
}

contract UserSovereignAgentOneShotConsumer is SovereignAgentOneShotConsumerCore {
    constructor(address schedulerAddress, address initialOwner)
        SovereignAgentOneShotConsumerCore(schedulerAddress, initialOwner)
    {}
}
