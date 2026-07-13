// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UserScheduledJqConsumer} from "./ScheduledJqConsumer.sol";

/// @notice Deploys one deterministic owner-controlled Scheduled JQ consumer per wallet.
contract ScheduledJqConsumerFactory {
    address public immutable scheduler;
    mapping(address owner => address consumer) public consumerOf;

    event ConsumerCreated(address indexed owner, address indexed consumer);

    error InvalidScheduler();

    constructor(address schedulerAddress) {
        if (schedulerAddress == address(0)) revert InvalidScheduler();
        scheduler = schedulerAddress;
    }

    function createConsumer() external returns (address consumer) {
        consumer = consumerOf[msg.sender];
        if (consumer != address(0)) return consumer;

        consumer = address(new UserScheduledJqConsumer{salt: _salt(msg.sender)}(scheduler, msg.sender));
        consumerOf[msg.sender] = consumer;
        emit ConsumerCreated(msg.sender, consumer);
    }

    function predictConsumer(address owner) external view returns (address) {
        bytes memory creationCode =
            abi.encodePacked(type(UserScheduledJqConsumer).creationCode, abi.encode(scheduler, owner));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(owner), keccak256(creationCode)));
        return address(uint160(uint256(hash)));
    }

    function _salt(address owner) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("PRECOMPILE_STUDIO_SCHEDULED_JQ", owner));
    }
}
