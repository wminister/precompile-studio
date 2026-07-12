// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

/// @notice Precompile Studio's Ritual LLM consumer.
/// @dev Full completion and metadata remain in receipt.spcCalls. Contract
///      storage keeps compact evidence so large model outputs are not stored twice.
contract LlmPrecompileConsumer is PrecompileConsumer {
    address internal constant LLM_INFERENCE_PRECOMPILE =
        0x0000000000000000000000000000000000000802;

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    struct ResultEvidence {
        address caller;
        bool hasError;
        uint64 completionLength;
        uint64 metadataLength;
        bytes32 completionHash;
        bytes32 metadataHash;
        bytes32 errorHash;
        bytes32 historyHash;
    }

    ResultEvidence public lastResult;

    event LlmResult(
        address indexed caller,
        bool hasError,
        uint256 completionLength,
        bytes32 completionHash,
        string errorMessage
    );

    function callLlmRaw(
        bytes calldata llmInput
    ) external returns (bool hasError, bytes32 completionHash, uint256 completionLength) {
        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
        bytes memory completionData;
        bytes memory modelMetadata;
        string memory errorMessage;
        StorageRef memory updatedConvoHistory;

        (hasError, completionData, modelMetadata, errorMessage, updatedConvoHistory) =
            abi.decode(output, (bool, bytes, bytes, string, StorageRef));

        completionLength = completionData.length;
        completionHash = keccak256(completionData);
        lastResult = ResultEvidence({
            caller: msg.sender,
            hasError: hasError,
            completionLength: uint64(completionLength),
            metadataLength: uint64(modelMetadata.length),
            completionHash: completionHash,
            metadataHash: keccak256(modelMetadata),
            errorHash: keccak256(bytes(errorMessage)),
            historyHash: keccak256(abi.encode(updatedConvoHistory))
        });

        emit LlmResult(msg.sender, hasError, completionLength, completionHash, errorMessage);
    }
}
