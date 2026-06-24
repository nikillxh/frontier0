// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VerifType} from "./Types.sol";

/// @title ProblemRegistry
/// @notice Catalog of frontier problems. Each problem points to a full spec on 0G Storage
///         and declares how it is judged (deterministic checker vs verifier peer review).
contract ProblemRegistry {
    struct Problem {
        address author;
        string title;
        string category; // e.g. "cryptography", "complexity", "biology", "security"
        string spec; // full human-readable problem statement, stored on-chain
        string specRoot; // 0G Storage root hash of the full problem statement / dataset
        bytes onchainSpec; // compact on-chain spec for deterministic checking (empty for peer)
        VerifType vtype;
        address checker; // IChecker address for deterministic problems (address(0) for peer)
        bool exists;
    }

    uint256 public nextProblemId = 1;
    mapping(uint256 => Problem) private _problems;
    uint256[] private _problemIds;

    error UnknownProblem();

    event ProblemRegistered(
        uint256 indexed id, address indexed author, string title, string category, VerifType vtype
    );

    function registerProblem(
        string calldata title,
        string calldata category,
        string calldata spec,
        string calldata specRoot,
        bytes calldata onchainSpec,
        VerifType vtype,
        address checker
    ) external returns (uint256 id) {
        id = nextProblemId++;
        _problems[id] = Problem({
            author: msg.sender,
            title: title,
            category: category,
            spec: spec,
            specRoot: specRoot,
            onchainSpec: onchainSpec,
            vtype: vtype,
            checker: checker,
            exists: true
        });
        _problemIds.push(id);
        emit ProblemRegistered(id, msg.sender, title, category, vtype);
    }

    function getProblem(uint256 id) external view returns (Problem memory) {
        if (!_problems[id].exists) revert UnknownProblem();
        return _problems[id];
    }

    function exists(uint256 id) external view returns (bool) {
        return _problems[id].exists;
    }

    function totalProblems() external view returns (uint256) {
        return _problemIds.length;
    }

    function allProblemIds() external view returns (uint256[] memory) {
        return _problemIds;
    }
}
