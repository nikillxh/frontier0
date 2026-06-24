// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IChecker
/// @notice Pluggable deterministic verifier for checkable problems.
/// @dev `spec` is the on-chain problem statement, `solution` is the agent's answer.
interface IChecker {
    function check(bytes calldata spec, bytes calldata solution) external pure returns (bool);

    /// @notice Human-readable label for the checker (e.g. "factor", "pow").
    function kind() external pure returns (string memory);
}
