// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Auth} from "./access/Auth.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {Reputation} from "./Reputation.sol";
import {ProblemRegistry} from "./ProblemRegistry.sol";
import {IChecker} from "./interfaces/IChecker.sol";
import {YumaConsensus} from "./lib/YumaConsensus.sol";
import {VerifType, BountyStatus} from "./Types.sol";

/// @title BountyEscrow
/// @notice The FRONTIER0 market: escrows bounties, accepts submissions, runs deterministic
///         or collusion-resistant peer verification, pays out, and updates reputation.
///         Also implements guardrailed agent-to-agent compute sub-bounties.
contract BountyEscrow is Auth {
    using YumaConsensus for uint256[];

    uint256 public constant SCALE = 1e4;

    // ----- tunable parameters -----
    uint256 public kappaBps = 5000; // consensus stake threshold (50%)
    uint256 public acceptThresholdBps = 5000; // min consensus to accept a peer submission
    uint256 public solverShareBps = 8000; // solver gets 80%, verifiers split 20%
    uint256 public accurateClosenessBps = 7000; // verifier counted "accurate" if this close
    uint256 public maxDepth = 3; // max agent-to-agent delegation depth
    uint256 public confirmThreshold = 0.05 ether; // sub-bounty above this needs explicit confirm
    uint64 public revealWindow = 1 hours; // commit-reveal: reveal phase duration after deadline

    int256 public constant SOLVE_REP = 100;
    int256 public constant VERIFY_ACCURATE_REP = 10;
    int256 public constant VERIFY_INACCURATE_REP = -8;

    AgentRegistry public immutable registry;
    Reputation public immutable reputation;
    ProblemRegistry public immutable problems;

    struct Bounty {
        uint256 problemId;
        address poster;
        uint256 reward;
        VerifType vtype;
        address checker;
        uint64 deadline; // submit + commit cutoff
        uint64 revealEnd; // reveal cutoff (peer only); == deadline for deterministic
        BountyStatus status;
        uint256 winningSubmissionId;
        uint256 parentBountyId;
        uint256 depth;
        uint256 creatorAgentId; // 0 if posted by a human poster
        bool exists;
    }

    struct Submission {
        uint256 bountyId;
        uint256 agentId;
        string artifactRoot; // 0G Storage root of the full solution artifact
        bytes solution; // compact on-chain answer for deterministic checking
        bool exists;
    }

    uint256 public nextBountyId = 1;
    uint256 public nextSubmissionId = 1;

    mapping(uint256 => Bounty) private _bounties;
    mapping(uint256 => Submission) private _submissions;
    mapping(uint256 => uint256[]) private _bountySubmissions; // bountyId => submissionIds
    mapping(uint256 => uint256[]) private _subVerifiers; // submissionId => verifierAgentIds
    mapping(uint256 => mapping(uint256 => uint256)) private _score; // submissionId => verifierId => revealed score
    mapping(uint256 => mapping(uint256 => bool)) private _committed; // submissionId => verifierId => committed?
    mapping(uint256 => mapping(uint256 => bytes32)) private _commit; // submissionId => verifierId => commitment
    mapping(uint256 => mapping(uint256 => bool)) private _revealed; // submissionId => verifierId => revealed?
    uint256[] private _bountyIds;

    error UnknownBounty();
    error UnknownSubmission();
    error BountyClosed();
    error DeadlinePassed();
    error NotPoster();
    error NotAgentOwner();
    error CannotSolve();
    error CannotVerify();
    error WrongVerifType();
    error InvalidScore();
    error NotAllowed();
    error DepthExceeded();
    error PerTxCapExceeded();
    error ConfirmationRequired();
    error NoReward();
    error Reentrancy();
    error CommitPhaseActive();
    error RevealPhaseActive();
    error RevealPhaseOver();
    error NoCommit();
    error BadReveal();

    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    event BountyCreated(
        uint256 indexed id, uint256 indexed problemId, address indexed poster, uint256 reward, VerifType vtype
    );
    event SubBountyCreated(
        uint256 indexed id, uint256 indexed creatorAgentId, uint256 parentBountyId, uint256 depth, uint256 reward
    );
    event SubmissionMade(uint256 indexed bountyId, uint256 indexed submissionId, uint256 indexed agentId, string artifactRoot);
    event ScoreCommitted(uint256 indexed submissionId, uint256 indexed verifierAgentId, bytes32 commitment);
    event ScoreRevealed(uint256 indexed submissionId, uint256 indexed verifierAgentId, uint256 score);
    event Payout(uint256 indexed bountyId, uint256 indexed agentId, address indexed to, uint256 amount, bool solver);
    event BountyFinalized(uint256 indexed bountyId, uint256 winningSubmissionId, uint256 consensus);
    event BountyRefunded(uint256 indexed bountyId, address indexed poster, uint256 amount);

    constructor(address _owner, AgentRegistry _registry, Reputation _reputation, ProblemRegistry _problems)
        Auth(_owner)
    {
        registry = _registry;
        reputation = _reputation;
        problems = _problems;
    }

    // ----- parameter admin -----

    function setParams(
        uint256 _kappaBps,
        uint256 _acceptThresholdBps,
        uint256 _solverShareBps,
        uint256 _accurateClosenessBps,
        uint256 _maxDepth,
        uint256 _confirmThreshold
    ) external onlyOwner {
        require(_kappaBps <= SCALE && _acceptThresholdBps <= SCALE && _solverShareBps <= SCALE, "bps");
        kappaBps = _kappaBps;
        acceptThresholdBps = _acceptThresholdBps;
        solverShareBps = _solverShareBps;
        accurateClosenessBps = _accurateClosenessBps;
        maxDepth = _maxDepth;
        confirmThreshold = _confirmThreshold;
    }

    function setRevealWindow(uint64 _revealWindow) external onlyOwner {
        revealWindow = _revealWindow;
    }

    // ----- bounty creation -----

    function postBounty(uint256 problemId, uint64 deadline) external payable returns (uint256 id) {
        if (msg.value == 0) revert NoReward();
        ProblemRegistry.Problem memory p = problems.getProblem(problemId);
        id = _createBounty(problemId, msg.sender, msg.value, p.vtype, p.checker, deadline, 0, 0, 0);
        emit BountyCreated(id, problemId, msg.sender, msg.value, p.vtype);
    }

    /// @notice Agent-to-agent compute sub-bounty with on-chain guardrails.
    /// @dev msg.sender must be the creator agent's owner (the user-confirmation signal).
    function createSubBounty(
        uint256 creatorAgentId,
        uint256 problemId,
        uint64 deadline,
        uint256 parentBountyId,
        bool confirmed
    ) external payable returns (uint256 id) {
        AgentRegistry.Agent memory a = registry.getAgent(creatorAgentId);
        if (a.owner != msg.sender) revert NotAgentOwner();
        if (a.paused) revert CannotSolve();
        uint256 amount = msg.value;
        if (amount == 0) revert NoReward();
        if (amount > a.maxPerTx) revert PerTxCapExceeded();
        if (amount > confirmThreshold && !confirmed) revert ConfirmationRequired();

        uint256 depth = 1;
        if (parentBountyId != 0) {
            if (!_bounties[parentBountyId].exists) revert UnknownBounty();
            depth = _bounties[parentBountyId].depth + 1;
        }
        if (depth > maxDepth) revert DepthExceeded();

        // Enforce + decrement the agent's spend budget (reverts if insufficient).
        registry.spend(creatorAgentId, amount);

        ProblemRegistry.Problem memory p = problems.getProblem(problemId);
        id = _createBounty(problemId, msg.sender, amount, p.vtype, p.checker, deadline, parentBountyId, depth, creatorAgentId);
        emit SubBountyCreated(id, creatorAgentId, parentBountyId, depth, amount);
        emit BountyCreated(id, problemId, msg.sender, amount, p.vtype);
    }

    function _createBounty(
        uint256 problemId,
        address poster,
        uint256 reward,
        VerifType vtype,
        address checker,
        uint64 deadline,
        uint256 parentBountyId,
        uint256 depth,
        uint256 creatorAgentId
    ) internal returns (uint256 id) {
        id = nextBountyId++;
        uint64 revealEnd = vtype == VerifType.Peer ? deadline + revealWindow : deadline;
        _bounties[id] = Bounty({
            problemId: problemId,
            poster: poster,
            reward: reward,
            vtype: vtype,
            checker: checker,
            deadline: deadline,
            revealEnd: revealEnd,
            status: BountyStatus.Open,
            winningSubmissionId: 0,
            parentBountyId: parentBountyId,
            depth: depth,
            creatorAgentId: creatorAgentId,
            exists: true
        });
        _bountyIds.push(id);
    }

    // ----- participation -----

    function submitSolution(uint256 bountyId, uint256 agentId, string calldata artifactRoot, bytes calldata solution)
        external
        returns (uint256 submissionId)
    {
        Bounty memory b = _bounties[bountyId];
        if (!b.exists) revert UnknownBounty();
        if (b.status != BountyStatus.Open) revert BountyClosed();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();
        if (!registry.canSolve(agentId)) revert CannotSolve();
        if (registry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        // Allowlist guardrail for sub-bounties.
        if (b.creatorAgentId != 0) {
            AgentRegistry.Agent memory c = registry.getAgent(b.creatorAgentId);
            if (c.allowlistEnabled && !registry.hireAllowed(b.creatorAgentId, agentId)) revert NotAllowed();
        }

        submissionId = nextSubmissionId++;
        _submissions[submissionId] =
            Submission({bountyId: bountyId, agentId: agentId, artifactRoot: artifactRoot, solution: solution, exists: true});
        _bountySubmissions[bountyId].push(submissionId);
        emit SubmissionMade(bountyId, submissionId, agentId, artifactRoot);
    }

    /// @notice Phase 1: commit a sealed score. Commitment = keccak256(abi.encode(score, salt, verifierAgentId)).
    /// @dev Sealing the score until the commit window closes defeats mempool score-copying / herding.
    function commitScore(uint256 submissionId, uint256 verifierAgentId, bytes32 commitment) external {
        Submission memory s = _submissions[submissionId];
        if (!s.exists) revert UnknownSubmission();
        Bounty memory b = _bounties[s.bountyId];
        if (b.status != BountyStatus.Open) revert BountyClosed();
        if (b.vtype != VerifType.Peer) revert WrongVerifType();
        if (block.timestamp >= b.deadline) revert DeadlinePassed(); // commit window closed
        if (!registry.canVerify(verifierAgentId)) revert CannotVerify();
        if (registry.ownerOf(verifierAgentId) != msg.sender) revert NotAgentOwner();

        if (!_committed[submissionId][verifierAgentId]) {
            _committed[submissionId][verifierAgentId] = true;
            _subVerifiers[submissionId].push(verifierAgentId);
        }
        _commit[submissionId][verifierAgentId] = commitment;
        _revealed[submissionId][verifierAgentId] = false;
        emit ScoreCommitted(submissionId, verifierAgentId, commitment);
    }

    /// @notice Phase 2: reveal the committed score. Only revealed scores count toward consensus.
    function revealScore(uint256 submissionId, uint256 verifierAgentId, uint256 score, bytes32 salt) external {
        Submission memory s = _submissions[submissionId];
        if (!s.exists) revert UnknownSubmission();
        Bounty memory b = _bounties[s.bountyId];
        if (b.status != BountyStatus.Open) revert BountyClosed();
        if (b.vtype != VerifType.Peer) revert WrongVerifType();
        if (block.timestamp < b.deadline) revert CommitPhaseActive(); // reveal only after commits close
        if (block.timestamp >= b.revealEnd) revert RevealPhaseOver();
        if (registry.ownerOf(verifierAgentId) != msg.sender) revert NotAgentOwner();
        if (score > SCALE) revert InvalidScore();

        bytes32 c = _commit[submissionId][verifierAgentId];
        if (c == bytes32(0)) revert NoCommit();
        if (keccak256(abi.encode(score, salt, verifierAgentId)) != c) revert BadReveal();

        _score[submissionId][verifierAgentId] = score;
        _revealed[submissionId][verifierAgentId] = true;
        emit ScoreRevealed(submissionId, verifierAgentId, score);
    }

    // ----- finalization -----

    function finalize(uint256 bountyId) external nonReentrant {
        Bounty storage b = _bounties[bountyId];
        if (!b.exists) revert UnknownBounty();
        if (b.status != BountyStatus.Open) revert BountyClosed();

        if (b.vtype == VerifType.Deterministic) {
            // Poster may settle a checkable bounty as soon as a valid answer exists.
            if (msg.sender != b.poster && block.timestamp < b.deadline) revert DeadlinePassed();
            _finalizeDeterministic(bountyId, b);
        } else {
            // Peer bounties settle only once the reveal phase is over (all sealed scores opened).
            if (block.timestamp < b.revealEnd) revert RevealPhaseActive();
            _finalizePeer(bountyId, b);
        }
    }

    function _finalizeDeterministic(uint256 bountyId, Bounty storage b) internal {
        ProblemRegistry.Problem memory p = problems.getProblem(b.problemId);
        uint256[] memory subs = _bountySubmissions[bountyId];
        uint256 winner;
        for (uint256 i = 0; i < subs.length; i++) {
            Submission memory s = _submissions[subs[i]];
            if (IChecker(b.checker).check(p.onchainSpec, s.solution)) {
                winner = subs[i];
                break;
            }
        }
        if (winner == 0) {
            _refund(bountyId, b);
            return;
        }
        b.status = BountyStatus.Finalized;
        b.winningSubmissionId = winner;
        Submission memory ws = _submissions[winner];
        _pay(bountyId, ws.agentId, b.reward, true);
        reputation.recordSolve(ws.agentId, b.reward, SOLVE_REP);
        emit BountyFinalized(bountyId, winner, SCALE);
    }

    function _finalizePeer(uint256 bountyId, Bounty storage b) internal {
        uint256[] memory subs = _bountySubmissions[bountyId];
        uint256 bestSub;
        uint256 bestConsensus;

        for (uint256 i = 0; i < subs.length; i++) {
            uint256 c = _consensusFor(subs[i]);
            if (c > bestConsensus) {
                bestConsensus = c;
                bestSub = subs[i];
            }
        }

        if (bestSub == 0 || bestConsensus < acceptThresholdBps) {
            _refund(bountyId, b);
            return;
        }

        b.status = BountyStatus.Finalized;
        b.winningSubmissionId = bestSub;

        uint256 reward = b.reward;
        uint256 solverAmount = (reward * solverShareBps) / SCALE;
        uint256 verifierPool = reward - solverAmount;
        uint256 distributed = _distributeVerifierRewards(bestSub, bestConsensus, verifierPool);

        // Solver receives its share plus any undistributed verifier dust.
        Submission memory ws = _submissions[bestSub];
        uint256 solverPay = solverAmount + (verifierPool - distributed);
        _pay(bountyId, ws.agentId, solverPay, true);
        reputation.recordSolve(ws.agentId, solverPay, SOLVE_REP);
        emit BountyFinalized(bountyId, bestSub, bestConsensus);
    }

    function _distributeVerifierRewards(uint256 submissionId, uint256 consensus, uint256 pool)
        internal
        returns (uint256 distributed)
    {
        uint256[] memory verifiers = _revealedVerifiers(submissionId);
        uint256 n = verifiers.length;
        if (n == 0) return 0;

        uint256[] memory weights = new uint256[](n);
        uint256 totalWeight;
        for (uint256 i = 0; i < n; i++) {
            uint256 stake = registry.stakeOf(verifiers[i]);
            uint256 close = YumaConsensus.closeness(_score[submissionId][verifiers[i]], consensus);
            uint256 w = stake * close;
            weights[i] = w;
            totalWeight += w;
        }

        for (uint256 i = 0; i < n; i++) {
            uint256 close = YumaConsensus.closeness(_score[submissionId][verifiers[i]], consensus);
            bool accurate = close >= accurateClosenessBps;
            uint256 payout = totalWeight > 0 ? (pool * weights[i]) / totalWeight : 0;
            if (payout > 0) {
                distributed += payout;
                _pay(0, verifiers[i], payout, false);
            }
            reputation.recordVerification(
                verifiers[i], accurate, payout, accurate ? VERIFY_ACCURATE_REP : VERIFY_INACCURATE_REP
            );
        }
    }

    function _refund(uint256 bountyId, Bounty storage b) internal {
        b.status = BountyStatus.Refunded;
        uint256 amount = b.reward;
        address poster = b.poster;
        if (amount > 0) {
            (bool ok,) = payable(poster).call{value: amount}("");
            require(ok, "refund failed");
        }
        emit BountyRefunded(bountyId, poster, amount);
    }

    function _pay(uint256 bountyId, uint256 agentId, uint256 amount, bool solver) internal {
        address to = registry.ownerOf(agentId);
        if (amount > 0) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "pay failed");
        }
        emit Payout(bountyId, agentId, to, amount, solver);
    }

    // ----- views -----

    function _revealedVerifiers(uint256 submissionId) internal view returns (uint256[] memory list) {
        uint256[] memory all = _subVerifiers[submissionId];
        uint256 m;
        for (uint256 i = 0; i < all.length; i++) {
            if (_revealed[submissionId][all[i]]) m++;
        }
        list = new uint256[](m);
        uint256 j;
        for (uint256 i = 0; i < all.length; i++) {
            if (_revealed[submissionId][all[i]]) list[j++] = all[i];
        }
    }

    function _consensusFor(uint256 submissionId) internal view returns (uint256) {
        uint256[] memory verifiers = _revealedVerifiers(submissionId);
        uint256 n = verifiers.length;
        uint256[] memory scores = new uint256[](n);
        uint256[] memory stakes = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            scores[i] = _score[submissionId][verifiers[i]];
            stakes[i] = registry.stakeOf(verifiers[i]);
        }
        return YumaConsensus.consensusScore(scores, stakes, kappaBps);
    }

    function consensusOf(uint256 submissionId) external view returns (uint256) {
        return _consensusFor(submissionId);
    }

    function getBounty(uint256 id) external view returns (Bounty memory) {
        if (!_bounties[id].exists) revert UnknownBounty();
        return _bounties[id];
    }

    function getSubmission(uint256 id) external view returns (Submission memory) {
        if (!_submissions[id].exists) revert UnknownSubmission();
        return _submissions[id];
    }

    function submissionsOf(uint256 bountyId) external view returns (uint256[] memory) {
        return _bountySubmissions[bountyId];
    }

    function verifiersOf(uint256 submissionId) external view returns (uint256[] memory) {
        return _subVerifiers[submissionId];
    }

    function scoreOf(uint256 submissionId, uint256 verifierAgentId) external view returns (uint256) {
        return _score[submissionId][verifierAgentId];
    }

    function isRevealed(uint256 submissionId, uint256 verifierAgentId) external view returns (bool) {
        return _revealed[submissionId][verifierAgentId];
    }

    function revealedVerifiersOf(uint256 submissionId) external view returns (uint256[] memory) {
        return _revealedVerifiers(submissionId);
    }

    /// @notice 0=submit/commit, 1=reveal, 2=ready-to-finalize, 3=closed.
    function bountyPhase(uint256 bountyId) external view returns (uint8) {
        Bounty memory b = _bounties[bountyId];
        if (!b.exists) revert UnknownBounty();
        if (b.status != BountyStatus.Open) return 3;
        if (b.vtype == VerifType.Deterministic) {
            return block.timestamp < b.deadline ? 0 : 2;
        }
        if (block.timestamp < b.deadline) return 0;
        if (block.timestamp < b.revealEnd) return 1;
        return 2;
    }

    function totalBounties() external view returns (uint256) {
        return _bountyIds.length;
    }

    function allBountyIds() external view returns (uint256[] memory) {
        return _bountyIds;
    }
}
