// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ScheduledJqConsumerCore} from "../contracts/ScheduledJqConsumer.sol";
import {ScheduledJqConsumerFactory} from "../contracts/ScheduledJqConsumerFactory.sol";

interface FactoryVm {
    function prank(address sender) external;
}

contract ScheduledJqConsumerFactoryTest {
    FactoryVm private constant vm = FactoryVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant SCHEDULER = address(0x1234);
    address private constant USER = address(0xBEEF);

    ScheduledJqConsumerFactory private factory;

    function setUp() public {
        factory = new ScheduledJqConsumerFactory(SCHEDULER);
    }

    function testCreatesPredictedConsumerOwnedByCaller() public {
        address predicted = factory.predictConsumer(USER);

        vm.prank(USER);
        address consumer = factory.createConsumer();

        require(consumer == predicted, "deterministic address");
        require(factory.consumerOf(USER) == consumer, "factory mapping");
        require(ScheduledJqConsumerCore(payable(consumer)).owner() == USER, "user ownership");
        require(address(ScheduledJqConsumerCore(payable(consumer)).scheduler()) == SCHEDULER, "scheduler wiring");
    }

    function testReturnsExistingConsumer() public {
        vm.prank(USER);
        address first = factory.createConsumer();
        vm.prank(USER);
        address second = factory.createConsumer();

        require(first == second, "one consumer per wallet");
    }

    function testRejectsZeroScheduler() public {
        try new ScheduledJqConsumerFactory(address(0)) {
            revert("expected revert");
        } catch {}
    }
}
