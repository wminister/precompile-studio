// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

/// @notice Precompile Studio's Ritual HTTP consumer.
/// @dev Full response data remains in receipt.spcCalls. Contract storage keeps
///      compact evidence so large response bodies are not paid for twice.
contract HttpPrecompileConsumer is PrecompileConsumer {
    address internal constant HTTP_CALL_PRECOMPILE =
        0x0000000000000000000000000000000000000801;

    struct ResultEvidence {
        address caller;
        uint16 statusCode;
        uint64 bodyLength;
        bytes32 bodyHash;
        bytes32 errorHash;
    }

    ResultEvidence public lastResult;

    event HttpResult(
        address indexed caller,
        uint16 statusCode,
        uint256 bodyLength,
        bytes32 bodyHash,
        string errorMessage
    );

    function callHTTPCallRaw(
        bytes calldata httpInput
    ) external returns (uint16 statusCode, bytes32 bodyHash, uint256 bodyLength) {
        bytes memory output = _executePrecompile(HTTP_CALL_PRECOMPILE, httpInput);
        bytes memory body;
        string memory errorMessage;

        (statusCode, , , body, errorMessage) = abi.decode(
            output,
            (uint16, string[], string[], bytes, string)
        );

        bodyLength = body.length;
        bodyHash = keccak256(body);
        lastResult = ResultEvidence({
            caller: msg.sender,
            statusCode: statusCode,
            bodyLength: uint64(bodyLength),
            bodyHash: bodyHash,
            errorHash: keccak256(bytes(errorMessage))
        });

        emit HttpResult(msg.sender, statusCode, bodyLength, bodyHash, errorMessage);
    }
}
