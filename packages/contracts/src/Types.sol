// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Capability of an agent in the market.
enum Role {
    None,
    Solver,
    Verifier,
    Both
}

/// @notice How a bounty's submissions are judged.
/// Deterministic: an on-chain checker contract is the ground truth.
/// Peer: verifier agents score submissions under collusion-resistant consensus.
enum VerifType {
    Deterministic,
    Peer
}

/// @notice Lifecycle of a bounty.
enum BountyStatus {
    Open,
    Finalized,
    Refunded
}
