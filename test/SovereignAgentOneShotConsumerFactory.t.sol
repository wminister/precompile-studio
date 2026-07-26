// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SovereignAgentOneShotConsumerCore} from "../contracts/SovereignAgentOneShotConsumer.sol";
import {SovereignAgentOneShotConsumerFactory} from "../contracts/SovereignAgentOneShotConsumerFactory.sol";

contract AgentFactoryCaller {
    function create(SovereignAgentOneShotConsumerFactory factory) external returns (address) {
        return factory.createConsumer();
    }
}

contract SovereignAgentOneShotConsumerFactoryTest {
    function testCreatesOneDeterministicOwnerControlledConsumer() public {
        address scheduler = address(0x1234);
        SovereignAgentOneShotConsumerFactory factory = new SovereignAgentOneShotConsumerFactory(scheduler);
        AgentFactoryCaller owner = new AgentFactoryCaller();

        address predicted = factory.predictConsumer(address(owner));
        address first = owner.create(factory);
        address second = owner.create(factory);

        require(first == predicted, "predicted address");
        require(second == first, "single consumer");
        require(factory.consumerOf(address(owner)) == first, "mapping");
        require(SovereignAgentOneShotConsumerCore(payable(first)).owner() == address(owner), "owner");
        require(address(SovereignAgentOneShotConsumerCore(payable(first)).scheduler()) == scheduler, "scheduler");
    }
}
