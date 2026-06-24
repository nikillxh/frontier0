// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Auth} from "./access/Auth.sol";
import {Role} from "./Types.sol";

/// @title AgentRegistry
/// @notice On-chain identity, stake and guardrails for solver/verifier agents.
/// @dev Stake is held by this contract. The market (operator) may decrement an agent's
///      sub-bounty spend budget and slash stake on misbehavior.
contract AgentRegistry is Auth {
    struct Agent {
        address owner;
        string name;
        Role role;
        uint256 stake; // wei staked, held by this contract
        uint256 spendBudget; // remaining allowance for creating sub-bounties (wei)
        uint256 maxPerTx; // per-sub-bounty cap (wei)
        bool paused; // owner kill-switch
        bool exists;
        bool allowlistEnabled; // if true, only allow-listed agents may answer this agent's sub-bounties
        string metaRoot; // 0G Storage root hash of agent metadata
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    mapping(uint256 => mapping(uint256 => bool)) public hireAllowed; // creator => candidate => allowed
    uint256[] private _agentIds;

    error UnknownAgent();
    error NotAgentOwner();
    error AgentPaused();
    error BudgetExceeded();

    event AgentRegistered(uint256 indexed id, address indexed owner, string name, Role role, uint256 stake);
    event StakeAdded(uint256 indexed id, uint256 amount, uint256 newStake);
    event StakeSlashed(uint256 indexed id, uint256 amount, address indexed to);
    event BudgetSet(uint256 indexed id, uint256 budget);
    event BudgetSpent(uint256 indexed id, uint256 amount, uint256 remaining);
    event MaxPerTxSet(uint256 indexed id, uint256 maxPerTx);
    event PausedSet(uint256 indexed id, bool paused);
    event AllowlistSet(uint256 indexed id, bool enabled);
    event HireAllowedSet(uint256 indexed id, uint256 indexed candidate, bool allowed);

    constructor(address _owner) Auth(_owner) {}

    modifier onlyAgentOwner(uint256 id) {
        if (!_agents[id].exists) revert UnknownAgent();
        if (_agents[id].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    function registerAgent(string calldata name, Role role, uint256 maxPerTx, string calldata metaRoot)
        external
        payable
        returns (uint256 id)
    {
        id = nextAgentId++;
        _agents[id] = Agent({
            owner: msg.sender,
            name: name,
            role: role,
            stake: msg.value,
            spendBudget: 0,
            maxPerTx: maxPerTx,
            paused: false,
            exists: true,
            allowlistEnabled: false,
            metaRoot: metaRoot
        });
        _agentIds.push(id);
        emit AgentRegistered(id, msg.sender, name, role, msg.value);
    }

    function addStake(uint256 id) external payable onlyAgentOwner(id) {
        _agents[id].stake += msg.value;
        emit StakeAdded(id, msg.value, _agents[id].stake);
    }

    function setBudget(uint256 id, uint256 budget) external onlyAgentOwner(id) {
        _agents[id].spendBudget = budget;
        emit BudgetSet(id, budget);
    }

    function setMaxPerTx(uint256 id, uint256 maxPerTx) external onlyAgentOwner(id) {
        _agents[id].maxPerTx = maxPerTx;
        emit MaxPerTxSet(id, maxPerTx);
    }

    function setPaused(uint256 id, bool paused) external onlyAgentOwner(id) {
        _agents[id].paused = paused;
        emit PausedSet(id, paused);
    }

    function setAllowlistEnabled(uint256 id, bool enabled) external onlyAgentOwner(id) {
        _agents[id].allowlistEnabled = enabled;
        emit AllowlistSet(id, enabled);
    }

    function setHireAllowed(uint256 id, uint256 candidate, bool allowed) external onlyAgentOwner(id) {
        hireAllowed[id][candidate] = allowed;
        emit HireAllowedSet(id, candidate, allowed);
    }

    /// @notice Owner kill-switch: pause the agent and withdraw its stake.
    function kill(uint256 id) external onlyAgentOwner(id) {
        Agent storage a = _agents[id];
        a.paused = true;
        uint256 amount = a.stake;
        a.stake = 0;
        emit PausedSet(id, true);
        if (amount > 0) {
            (bool ok,) = payable(a.owner).call{value: amount}("");
            require(ok, "stake refund failed");
        }
    }

    // ----- operator (market) hooks -----

    /// @notice Decrement an agent's sub-bounty spend budget. Reverts if insufficient.
    function spend(uint256 id, uint256 amount) external onlyOperator {
        Agent storage a = _agents[id];
        if (!a.exists) revert UnknownAgent();
        if (amount > a.spendBudget) revert BudgetExceeded();
        a.spendBudget -= amount;
        emit BudgetSpent(id, amount, a.spendBudget);
    }

    /// @notice Slash staked funds from a misbehaving agent and send them to `to`.
    function slashStake(uint256 id, uint256 amount, address to) external onlyOperator {
        Agent storage a = _agents[id];
        if (!a.exists) revert UnknownAgent();
        uint256 slash = amount > a.stake ? a.stake : amount;
        a.stake -= slash;
        emit StakeSlashed(id, slash, to);
        if (slash > 0 && to != address(0)) {
            (bool ok,) = payable(to).call{value: slash}("");
            require(ok, "slash transfer failed");
        }
    }

    // ----- views -----

    function getAgent(uint256 id) external view returns (Agent memory) {
        if (!_agents[id].exists) revert UnknownAgent();
        return _agents[id];
    }

    function exists(uint256 id) external view returns (bool) {
        return _agents[id].exists;
    }

    function stakeOf(uint256 id) external view returns (uint256) {
        return _agents[id].stake;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _agents[id].owner;
    }

    function isPaused(uint256 id) external view returns (bool) {
        return _agents[id].paused;
    }

    function canSolve(uint256 id) external view returns (bool) {
        Role r = _agents[id].role;
        return _agents[id].exists && !_agents[id].paused && (r == Role.Solver || r == Role.Both);
    }

    function canVerify(uint256 id) external view returns (bool) {
        Role r = _agents[id].role;
        return _agents[id].exists && !_agents[id].paused && (r == Role.Verifier || r == Role.Both);
    }

    function totalAgents() external view returns (uint256) {
        return _agentIds.length;
    }

    function agentIdAt(uint256 index) external view returns (uint256) {
        return _agentIds[index];
    }

    function allAgentIds() external view returns (uint256[] memory) {
        return _agentIds;
    }
}
