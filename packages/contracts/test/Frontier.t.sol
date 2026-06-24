// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {MiniTest} from "./utils/MiniTest.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Reputation} from "../src/Reputation.sol";
import {ProblemRegistry} from "../src/ProblemRegistry.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";
import {FactorChecker} from "../src/checkers/FactorChecker.sol";
import {Role, VerifType, BountyStatus} from "../src/Types.sol";

contract FrontierTest is MiniTest {
    AgentRegistry registry;
    Reputation reputation;
    ProblemRegistry problems;
    BountyEscrow escrow;
    FactorChecker factorChecker;

    address poster = address(0xE1);
    address solverH = address(0xA1);
    address solverC = address(0xC1);
    address vh1 = address(0xB1);
    address vh2 = address(0xB2);
    address vh3 = address(0xB3);
    address cab1 = address(0xD1);
    address cab2 = address(0xD2);

    function setUp() public {
        registry = new AgentRegistry(address(this));
        reputation = new Reputation(address(this));
        problems = new ProblemRegistry();
        factorChecker = new FactorChecker();
        escrow = new BountyEscrow(address(this), registry, reputation, problems);
        registry.setOperator(address(escrow), true);
        reputation.setOperator(address(escrow), true);
    }

    function _register(address owner, string memory name, Role role, uint256 stake) internal returns (uint256 id) {
        vm.deal(owner, stake + 5 ether);
        vm.prank(owner);
        id = registry.registerAgent{value: stake}(name, role, 1 ether, "meta-root");
    }

    // ---- deterministic checkable problem ----
    function testDeterministicFactor() public {
        uint256 solver = _register(solverH, "solver-h", Role.Solver, 1 ether);
        uint256 pid = problems.registerProblem(
            "Factor 77", "cryptography", "factor the semiprime 77", "spec-root", abi.encode(uint256(77)), VerifType.Deterministic, address(factorChecker)
        );

        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 bid = escrow.postBounty{value: 1 ether}(pid, uint64(block.timestamp + 1 days));

        // wrong answer first (3 * 5 = 15)
        vm.prank(solverH);
        escrow.submitSolution(bid, solver, "art-wrong", abi.encode(uint256(3), uint256(5)));
        // correct answer (7 * 11 = 77)
        vm.prank(solverH);
        escrow.submitSolution(bid, solver, "art-right", abi.encode(uint256(7), uint256(11)));

        uint256 balBefore = solverH.balance;
        vm.prank(poster);
        escrow.finalize(bid);

        assertEq(solverH.balance, balBefore + 1 ether, "solver should receive full reward");
        BountyEscrow.Bounty memory b = escrow.getBounty(bid);
        assertEq(uint256(b.status), uint256(BountyStatus.Finalized), "bounty finalized");
        Reputation.Rep memory r = reputation.repOf(solver);
        assertEq(r.solves, 1, "solve recorded");
        assertGt(r.totalEarned, 0, "earnings recorded");
    }

    // ---- collusion-resistant peer consensus ----
    function testPeerConsensusResistsMinorityCabal() public {
        // honest verifiers: 30 stake total; cabal: 20 stake total => cabal is 40% (< 50%)
        uint256 sH = _register(solverH, "solver-h", Role.Solver, 1 ether);
        uint256 sC = _register(solverC, "solver-c", Role.Solver, 1 ether);
        uint256 h1 = _register(vh1, "honest-1", Role.Verifier, 10 ether);
        uint256 h2 = _register(vh2, "honest-2", Role.Verifier, 10 ether);
        uint256 h3 = _register(vh3, "honest-3", Role.Verifier, 10 ether);
        uint256 c1 = _register(cab1, "cabal-1", Role.Verifier, 10 ether);
        uint256 c2 = _register(cab2, "cabal-2", Role.Verifier, 10 ether);

        uint256 pid = problems.registerProblem(
            "P vs NP proof sketch", "complexity", "sketch a separation direction", "spec-root", "", VerifType.Peer, address(0)
        );
        vm.deal(poster, 10 ether);
        uint64 dl = uint64(block.timestamp + 1 days);
        vm.prank(poster);
        uint256 bid = escrow.postBounty{value: 1 ether}(pid, dl);

        // honest solver good submission; cabal solver bad submission
        vm.prank(solverH);
        uint256 subGood = escrow.submitSolution(bid, sH, "good-root", "");
        vm.prank(solverC);
        uint256 subBad = escrow.submitSolution(bid, sC, "bad-root", "");

        // ---- commit phase: sealed scores (mempool reveals nothing) ----
        _commit(vh1, subGood, h1, 9000);
        _commit(vh2, subGood, h2, 9000);
        _commit(vh3, subGood, h3, 9000);
        _commit(vh1, subBad, h1, 1000);
        _commit(vh2, subBad, h2, 1000);
        _commit(vh3, subBad, h3, 1000);
        // cabal tries to push its bad submission high and tank the good one
        _commit(cab1, subGood, c1, 1000);
        _commit(cab2, subGood, c2, 1000);
        _commit(cab1, subBad, c1, 9000);
        _commit(cab2, subBad, c2, 9000);

        // ---- reveal phase ----
        vm.warp(dl + 1);
        _reveal(vh1, subGood, h1, 9000);
        _reveal(vh2, subGood, h2, 9000);
        _reveal(vh3, subGood, h3, 9000);
        _reveal(vh1, subBad, h1, 1000);
        _reveal(vh2, subBad, h2, 1000);
        _reveal(vh3, subBad, h3, 1000);
        _reveal(cab1, subGood, c1, 1000);
        _reveal(cab2, subGood, c2, 1000);
        _reveal(cab1, subBad, c1, 9000);
        _reveal(cab2, subBad, c2, 9000);

        uint256 cGood = escrow.consensusOf(subGood);
        uint256 cBad = escrow.consensusOf(subBad);
        assertGt(cGood, cBad, "honest submission must out-consensus the cabal");
        assertGt(cGood, 5000, "honest submission accepted");
        assertLt(cBad, 5000, "cabal submission rejected");

        vm.warp(dl + 1 hours + 1);
        vm.prank(poster);
        escrow.finalize(bid);

        BountyEscrow.Bounty memory b = escrow.getBounty(bid);
        assertEq(b.winningSubmissionId, subGood, "good submission wins");
        Reputation.Rep memory rGood = reputation.repOf(sH);
        assertEq(rGood.solves, 1, "honest solver credited");
        Reputation.Rep memory rBad = reputation.repOf(sC);
        assertEq(rBad.solves, 0, "cabal solver not credited");
    }

    // ---- commit-reveal integrity ----
    function testRevealRejectsForgedSaltAndExcludesUnrevealed() public {
        uint256 sH = _register(solverH, "solver-h", Role.Solver, 1 ether);
        uint256 h1 = _register(vh1, "honest-1", Role.Verifier, 10 ether);
        uint256 h2 = _register(vh2, "honest-2", Role.Verifier, 10 ether);

        uint256 pid = problems.registerProblem("open problem", "complexity", "an open question", "spec", "", VerifType.Peer, address(0));
        vm.deal(poster, 10 ether);
        uint64 dl = uint64(block.timestamp + 1 days);
        vm.prank(poster);
        uint256 bid = escrow.postBounty{value: 1 ether}(pid, dl);
        vm.prank(solverH);
        uint256 sub = escrow.submitSolution(bid, sH, "root", "");

        _commit(vh1, sub, h1, 8000);
        _commit(vh2, sub, h2, 9000);

        vm.warp(dl + 1);

        // forged salt must revert
        vm.prank(vh1);
        vm.expectRevert(BountyEscrow.BadReveal.selector);
        escrow.revealScore(sub, h1, 8000, keccak256("wrong-salt"));

        // honest reveal for h1 only; h2 never reveals -> excluded from consensus
        _reveal(vh1, sub, h1, 8000);

        assertEq(escrow.isRevealed(sub, h1), true, "h1 revealed");
        assertEq(escrow.isRevealed(sub, h2), false, "h2 not revealed");
        assertEq(escrow.revealedVerifiersOf(sub).length, 1, "only revealed counts");
        // consensus computed from the single revealed score (8000)
        assertEq(escrow.consensusOf(sub), 8000, "consensus from revealed score only");
    }

    function _salt(uint256 submissionId, uint256 verifierAgentId) internal pure returns (bytes32) {
        return keccak256(abi.encode(verifierAgentId, submissionId, uint256(0x5A17)));
    }

    function _commit(address owner, uint256 submissionId, uint256 verifierAgentId, uint256 score) internal {
        bytes32 commitment = keccak256(abi.encode(score, _salt(submissionId, verifierAgentId), verifierAgentId));
        vm.prank(owner);
        escrow.commitScore(submissionId, verifierAgentId, commitment);
    }

    function _reveal(address owner, uint256 submissionId, uint256 verifierAgentId, uint256 score) internal {
        vm.prank(owner);
        escrow.revealScore(submissionId, verifierAgentId, score, _salt(submissionId, verifierAgentId));
    }

    // ---- agent-to-agent sub-bounty guardrails ----
    function testSubBountyGuardrails() public {
        uint256 agent = _register(solverH, "delegator", Role.Both, 1 ether);
        vm.prank(solverH);
        registry.setBudget(agent, 0.2 ether);

        uint256 pid =
            problems.registerProblem("delegated work", "compute", "do the compute", "spec-root", "", VerifType.Peer, address(0));
        vm.deal(solverH, 10 ether);

        uint64 dl = uint64(block.timestamp + 1 days);

        // amount above confirmThreshold (0.05) without confirmation -> revert
        vm.prank(solverH);
        vm.expectRevert(BountyEscrow.ConfirmationRequired.selector);
        escrow.createSubBounty{value: 0.08 ether}(agent, pid, dl, 0, false);

        // with confirmation -> ok; budget 0.2 -> 0.12
        vm.prank(solverH);
        escrow.createSubBounty{value: 0.08 ether}(agent, pid, dl, 0, true);

        // above per-tx cap (1 ether default maxPerTx) -> revert
        vm.prank(solverH);
        vm.expectRevert(BountyEscrow.PerTxCapExceeded.selector);
        escrow.createSubBounty{value: 1.5 ether}(agent, pid, dl, 0, true);

        // exceed remaining budget (0.12 left, spend 0.1 then 0.1 again) 
        vm.prank(solverH);
        escrow.createSubBounty{value: 0.1 ether}(agent, pid, dl, 0, true); // budget -> 0.02
        vm.prank(solverH);
        vm.expectRevert(AgentRegistry.BudgetExceeded.selector);
        escrow.createSubBounty{value: 0.1 ether}(agent, pid, dl, 0, true);
    }

    function testSubBountyDepthLimit() public {
        uint256 agent = _register(solverH, "deep", Role.Both, 1 ether);
        vm.prank(solverH);
        registry.setBudget(agent, 1 ether);
        uint256 pid = problems.registerProblem("deep", "compute", "deep delegation", "spec", "", VerifType.Peer, address(0));
        vm.deal(solverH, 10 ether);
        uint64 dl = uint64(block.timestamp + 1 days);

        // small amounts (< confirmThreshold) so no confirmation needed
        vm.prank(solverH);
        uint256 d1 = escrow.createSubBounty{value: 0.01 ether}(agent, pid, dl, 0, false); // depth 1
        vm.prank(solverH);
        uint256 d2 = escrow.createSubBounty{value: 0.01 ether}(agent, pid, dl, d1, false); // depth 2
        vm.prank(solverH);
        uint256 d3 = escrow.createSubBounty{value: 0.01 ether}(agent, pid, dl, d2, false); // depth 3
        vm.prank(solverH);
        vm.expectRevert(BountyEscrow.DepthExceeded.selector);
        escrow.createSubBounty{value: 0.01 ether}(agent, pid, dl, d3, false); // depth 4 -> revert
    }

    // ---- kill switch refunds stake ----
    function testKillSwitchRefundsStake() public {
        uint256 agent = _register(solverH, "killable", Role.Solver, 2 ether);
        uint256 balBefore = solverH.balance;
        vm.prank(solverH);
        registry.kill(agent);
        assertEq(solverH.balance, balBefore + 2 ether, "stake refunded on kill");
        assertEq(registry.isPaused(agent), true, "agent paused after kill");
    }
}
