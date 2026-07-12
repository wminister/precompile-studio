// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Shared helper for Ritual short-running async precompiles.
/// @dev Ritual returns an ABI envelope containing the simulated input and the
///      attested output. Consumers must unwrap the second value before decoding.
abstract contract PrecompileConsumer {
    function _executePrecompile(
        address target,
        bytes memory input
    ) internal returns (bytes memory actualOutput) {
        (bool ok, bytes memory envelope) = target.call(input);
        if (!ok) _revertWith(envelope);

        (, actualOutput) = abi.decode(envelope, (bytes, bytes));
    }

    function _revertWith(bytes memory reason) private pure {
        assembly ("memory-safe") {
            revert(add(reason, 0x20), mload(reason))
        }
    }
}
