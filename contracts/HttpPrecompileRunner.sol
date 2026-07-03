// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal consumer for Ritual's HTTP precompile at 0x0801.
/// @dev Deploy this contract, then call fetchHttp(bytes) with the ABI payload from Precompile Studio.
contract HttpPrecompileRunner {
    address internal constant HTTP_CALL_PRECOMPILE = 0x0000000000000000000000000000000000000801;

    event HttpResult(
        address indexed caller,
        uint16 statusCode,
        bytes body,
        string errorMessage
    );

    struct Response {
        uint16 statusCode;
        string[] headerKeys;
        string[] headerValues;
        bytes body;
        string errorMessage;
    }

    Response public lastResponse;

    function fetchHttp(bytes calldata httpInput) external returns (Response memory response) {
        bytes memory output = _executePrecompile(HTTP_CALL_PRECOMPILE, httpInput);
        (
            uint16 statusCode,
            string[] memory headerKeys,
            string[] memory headerValues,
            bytes memory body,
            string memory errorMessage
        ) = abi.decode(output, (uint16, string[], string[], bytes, string));

        response = Response({
            statusCode: statusCode,
            headerKeys: headerKeys,
            headerValues: headerValues,
            body: body,
            errorMessage: errorMessage
        });
        lastResponse = response;

        emit HttpResult(msg.sender, statusCode, body, errorMessage);
    }

    function _executePrecompile(address target, bytes memory input) internal returns (bytes memory output) {
        bool ok;
        (ok, output) = target.call(input);
        require(ok, "HTTP_PRECOMPILE_FAILED");
    }
}
