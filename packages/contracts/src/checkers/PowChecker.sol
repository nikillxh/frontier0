// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IChecker} from "../interfaces/IChecker.sol";

/// @title PowChecker
/// @notice Verifies a proof-of-work: given (challenge, difficulty), a nonce is valid iff
///         keccak256(challenge, nonce) has at least `difficulty` leading zero bits.
///         Models real computational work that is cheap to verify.
contract PowChecker is IChecker {
    function check(bytes calldata spec, bytes calldata solution) external pure returns (bool) {
        (bytes32 challenge, uint256 difficulty) = abi.decode(spec, (bytes32, uint256));
        uint256 nonce = abi.decode(solution, (uint256));
        if (difficulty == 0 || difficulty > 256) return false;
        bytes32 h = keccak256(abi.encodePacked(challenge, nonce));
        // Require the top `difficulty` bits to be zero.
        return uint256(h) >> (256 - difficulty) == 0;
    }

    function kind() external pure returns (string memory) {
        return "pow";
    }
}
