// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IChecker} from "../interfaces/IChecker.sol";

/// @title FactorChecker
/// @notice Verifies an integer factorization: given N, the solution (p, q) is valid iff
///         p * q == N with p, q > 1. Trivial to verify, hard to produce - a canonical
///         "checkable computation" bounty.
contract FactorChecker is IChecker {
    function check(bytes calldata spec, bytes calldata solution) external pure returns (bool) {
        uint256 n = abi.decode(spec, (uint256));
        (uint256 p, uint256 q) = abi.decode(solution, (uint256, uint256));
        if (p <= 1 || q <= 1) return false;
        unchecked {
            // p, q are factors of n (each < n), so p*q does not overflow a uint256.
            return p * q == n;
        }
    }

    function kind() external pure returns (string memory) {
        return "factor";
    }
}
