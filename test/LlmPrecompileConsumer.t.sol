// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LlmPrecompileConsumer} from "../contracts/LlmPrecompileConsumer.sol";

interface LlmVm {
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function mockCallRevert(address callee, bytes calldata data, bytes calldata revertData) external;
}

contract LlmPrecompileConsumerTest {
    LlmVm private constant vm = LlmVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant LLM_INFERENCE_PRECOMPILE =
        0x0000000000000000000000000000000000000802;

    LlmPrecompileConsumer private consumer;

    function setUp() public {
        consumer = new LlmPrecompileConsumer();
    }

    function testUnwrapsAndStoresCompactLlmEvidence() public {
        bytes memory input = abi.encode("prompt");
        bytes memory completion = bytes('{"choices":[{"message":{"content":"Ritual"}}]}');
        bytes memory metadata = bytes('{"model":"zai-org/GLM-4.7-FP8"}');
        LlmPrecompileConsumer.StorageRef memory history =
            LlmPrecompileConsumer.StorageRef("gcs", "convos/session.jsonl", "GCS_CREDS");
        bytes memory output = abi.encode(false, completion, metadata, "", history);

        vm.mockCall(LLM_INFERENCE_PRECOMPILE, input, abi.encode(input, output));

        (bool hasError, bytes32 completionHash, uint256 completionLength) =
            consumer.callLlmRaw(input);
        (
            address caller,
            bool storedHasError,
            uint64 storedCompletionLength,
            uint64 storedMetadataLength,
            bytes32 storedCompletionHash,
            bytes32 metadataHash,
            bytes32 errorHash,
            bytes32 historyHash
        ) = consumer.lastResult();

        require(!hasError && !storedHasError, "unexpected error");
        require(caller == address(this), "caller");
        require(completionLength == completion.length, "completion length");
        require(storedCompletionLength == completion.length, "stored completion length");
        require(storedMetadataLength == metadata.length, "metadata length");
        require(completionHash == keccak256(completion), "completion hash");
        require(storedCompletionHash == completionHash, "stored completion hash");
        require(metadataHash == keccak256(metadata), "metadata hash");
        require(errorHash == keccak256(bytes("")), "error hash");
        require(historyHash == keccak256(abi.encode(history)), "history hash");
    }

    function testStoresLlmErrorsWithoutReverting() public {
        bytes memory input = abi.encode("bad prompt");
        LlmPrecompileConsumer.StorageRef memory history =
            LlmPrecompileConsumer.StorageRef("gcs", "convos/session.jsonl", "GCS_CREDS");
        bytes memory output = abi.encode(true, bytes(""), bytes(""), "model unavailable", history);

        vm.mockCall(LLM_INFERENCE_PRECOMPILE, input, abi.encode(input, output));
        (bool hasError, bytes32 completionHash, uint256 completionLength) =
            consumer.callLlmRaw(input);

        require(hasError, "expected error");
        require(completionLength == 0, "completion length");
        require(completionHash == keccak256(bytes("")), "completion hash");
    }

    function testBubblesPrecompileRevert() public {
        bytes memory input = abi.encode("bad request");
        bytes memory revertData = abi.encodeWithSignature("Error(string)", "LLM_PRECOMPILE_FAILED");
        vm.mockCallRevert(LLM_INFERENCE_PRECOMPILE, input, revertData);

        (bool ok, bytes memory reason) = address(consumer).call(
            abi.encodeCall(LlmPrecompileConsumer.callLlmRaw, (input))
        );

        require(!ok, "expected revert");
        require(keccak256(reason) == keccak256(revertData), "revert data");
    }
}
