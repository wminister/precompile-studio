// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HttpPrecompileConsumer} from "../contracts/HttpPrecompileConsumer.sol";

interface Vm {
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function mockCallRevert(address callee, bytes calldata data, bytes calldata revertData) external;
}

contract HttpPrecompileConsumerTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant HTTP_CALL_PRECOMPILE =
        0x0000000000000000000000000000000000000801;

    HttpPrecompileConsumer private consumer;

    function setUp() public {
        consumer = new HttpPrecompileConsumer();
    }

    function testUnwrapsAndStoresCompactHttpEvidence() public {
        bytes memory input = abi.encode("request");
        bytes memory body = bytes('{"ok":true}');
        string[] memory headerKeys = new string[](1);
        string[] memory headerValues = new string[](1);
        headerKeys[0] = "content-type";
        headerValues[0] = "application/json";
        bytes memory output = abi.encode(uint16(200), headerKeys, headerValues, body, "");

        vm.mockCall(HTTP_CALL_PRECOMPILE, input, abi.encode(input, output));

        (uint16 statusCode, bytes32 bodyHash, uint256 bodyLength) =
            consumer.callHTTPCallRaw(input);
        (
            address caller,
            uint16 storedStatusCode,
            uint64 storedBodyLength,
            bytes32 storedBodyHash,
            bytes32 errorHash
        ) = consumer.lastResult();

        require(statusCode == 200, "status");
        require(bodyLength == body.length, "body length");
        require(bodyHash == keccak256(body), "body hash");
        require(caller == address(this), "caller");
        require(storedStatusCode == statusCode, "stored status");
        require(storedBodyLength == bodyLength, "stored length");
        require(storedBodyHash == bodyHash, "stored hash");
        require(errorHash == keccak256(bytes("")), "error hash");
    }

    function testStoresHttpErrorsWithoutReverting() public {
        bytes memory input = abi.encode("missing");
        bytes memory body = bytes('{"message":"Not Found"}');
        string[] memory empty = new string[](0);
        bytes memory output = abi.encode(uint16(404), empty, empty, body, "");

        vm.mockCall(HTTP_CALL_PRECOMPILE, input, abi.encode(input, output));
        (uint16 statusCode, bytes32 bodyHash, uint256 bodyLength) =
            consumer.callHTTPCallRaw(input);

        require(statusCode == 404, "status");
        require(bodyHash == keccak256(body), "body hash");
        require(bodyLength == body.length, "body length");
    }

    function testBubblesPrecompileRevert() public {
        bytes memory input = abi.encode("bad request");
        bytes memory revertData = abi.encodeWithSignature("Error(string)", "HTTP_PRECOMPILE_FAILED");
        vm.mockCallRevert(HTTP_CALL_PRECOMPILE, input, revertData);

        (bool ok, bytes memory reason) = address(consumer).call(
            abi.encodeCall(HttpPrecompileConsumer.callHTTPCallRaw, (input))
        );

        require(!ok, "expected revert");
        require(keccak256(reason) == keccak256(revertData), "revert data");
    }
}
