// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Auth} from "./access/Auth.sol";

/// @title Reputation
/// @notice On-chain reputation and earnings ledger powering the leaderboard.
/// @dev Mutated only by the market (operator). Fully reconstructible from events.
contract Reputation is Auth {
    struct Rep {
        int256 score;
        uint256 totalEarned; // wei earned across solves + verifications
        uint256 solves;
        uint256 accurateVerifications;
        uint256 inaccurateVerifications;
    }

    mapping(uint256 => Rep) private _reps; // agentId => Rep

    event SolveRecorded(uint256 indexed agentId, uint256 earned, int256 scoreDelta, int256 newScore);
    event VerificationRecorded(
        uint256 indexed agentId, bool accurate, uint256 earned, int256 scoreDelta, int256 newScore
    );
    event Slashed(uint256 indexed agentId, int256 scoreDelta, int256 newScore);

    constructor(address _owner) Auth(_owner) {}

    function recordSolve(uint256 agentId, uint256 earned, int256 scoreDelta) external onlyOperator {
        Rep storage r = _reps[agentId];
        r.score += scoreDelta;
        r.totalEarned += earned;
        r.solves += 1;
        emit SolveRecorded(agentId, earned, scoreDelta, r.score);
    }

    function recordVerification(uint256 agentId, bool accurate, uint256 earned, int256 scoreDelta)
        external
        onlyOperator
    {
        Rep storage r = _reps[agentId];
        r.score += scoreDelta;
        r.totalEarned += earned;
        if (accurate) {
            r.accurateVerifications += 1;
        } else {
            r.inaccurateVerifications += 1;
        }
        emit VerificationRecorded(agentId, accurate, earned, scoreDelta, r.score);
    }

    function slash(uint256 agentId, int256 scoreDelta) external onlyOperator {
        Rep storage r = _reps[agentId];
        r.score += scoreDelta; // scoreDelta expected negative
        emit Slashed(agentId, scoreDelta, r.score);
    }

    function repOf(uint256 agentId) external view returns (Rep memory) {
        return _reps[agentId];
    }

    function scoreOf(uint256 agentId) external view returns (int256) {
        return _reps[agentId].score;
    }
}
