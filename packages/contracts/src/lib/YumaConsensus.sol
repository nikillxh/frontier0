// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title YumaConsensus
/// @notice Collusion-resistant aggregation of verifier scores, inspired by Bittensor's
///         Yuma Consensus weight clipping.
/// @dev Scores are fixed-point in [0, SCALE]. Influence is stake-weighted. The consensus
///      value for a submission is the largest score `v` such that the stake-weighted mass
///      of verifiers scoring >= `v` is at least `kappa` of total stake. With kappa = 50%,
///      a colluding minority (< 50% of stake) can neither inflate its own submissions nor
///      suppress honest ones, because it cannot move the stake-weighted quantile.
library YumaConsensus {
    uint256 internal constant SCALE = 1e4;

    /// @notice Stake-weighted quantile of scores at threshold `kappaBps`.
    /// @param scores per-verifier score in [0, SCALE]
    /// @param stakes per-verifier stake weight (same length as `scores`)
    /// @param kappaBps consensus threshold as a fraction of SCALE (e.g. 5000 = 50%)
    /// @return consensus the clipped consensus score in [0, SCALE]
    function consensusScore(uint256[] memory scores, uint256[] memory stakes, uint256 kappaBps)
        internal
        pure
        returns (uint256 consensus)
    {
        uint256 n = scores.length;
        if (n == 0 || n != stakes.length) return 0;

        uint256 totalStake;
        for (uint256 i = 0; i < n; i++) {
            totalStake += stakes[i];
        }
        if (totalStake == 0) return 0;

        // Required stake mass that must score >= v for v to be "consensus".
        uint256 required = (totalStake * kappaBps) / SCALE;

        // Largest candidate score whose >= mass clears the required threshold.
        for (uint256 j = 0; j < n; j++) {
            uint256 v = scores[j];
            if (v <= consensus) continue; // can't improve the best-so-far
            uint256 massAtOrAbove;
            for (uint256 i = 0; i < n; i++) {
                if (scores[i] >= v) massAtOrAbove += stakes[i];
            }
            if (massAtOrAbove >= required) {
                consensus = v;
            }
        }
    }

    /// @notice Closeness of a single score to consensus, in [0, SCALE].
    /// @dev Used to compute verifier dividends: honest verifiers near consensus earn more.
    function closeness(uint256 score, uint256 consensus) internal pure returns (uint256) {
        uint256 diff = score > consensus ? score - consensus : consensus - score;
        return diff >= SCALE ? 0 : SCALE - diff;
    }
}
