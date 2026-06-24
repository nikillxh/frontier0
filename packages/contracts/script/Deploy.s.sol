// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Reputation} from "../src/Reputation.sol";
import {ProblemRegistry} from "../src/ProblemRegistry.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";
import {FactorChecker} from "../src/checkers/FactorChecker.sol";
import {PowChecker} from "../src/checkers/PowChecker.sol";

interface VmLike {
    function startBroadcast(uint256 privateKey) external;
    function startBroadcast() external;
    function stopBroadcast() external;
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
    function addr(uint256 privateKey) external pure returns (address);
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory);
    function writeJson(string calldata json, string calldata path) external;
}

/// @notice Deploys the full FRONTIER0 contract suite, wires operator permissions, and
///         writes the resulting addresses to a JSON file (path from DEPLOY_OUT).
contract Deploy {
    VmLike internal constant vm = VmLike(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external {
        uint256 pk = vm.envUint("DEPLOY_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        AgentRegistry registry = new AgentRegistry(deployer);
        Reputation reputation = new Reputation(deployer);
        ProblemRegistry problems = new ProblemRegistry();
        FactorChecker factorChecker = new FactorChecker();
        PowChecker powChecker = new PowChecker();
        BountyEscrow escrow = new BountyEscrow(deployer, registry, reputation, problems);

        // The market is the operator allowed to spend budgets, slash stake, write reputation.
        registry.setOperator(address(escrow), true);
        reputation.setOperator(address(escrow), true);

        vm.stopBroadcast();

        string memory out = vm.envOr("DEPLOY_OUT", string("deployments/local.json"));
        string memory obj = "frontier0";
        vm.serializeAddress(obj, "AgentRegistry", address(registry));
        vm.serializeAddress(obj, "Reputation", address(reputation));
        vm.serializeAddress(obj, "ProblemRegistry", address(problems));
        vm.serializeAddress(obj, "FactorChecker", address(factorChecker));
        vm.serializeAddress(obj, "PowChecker", address(powChecker));
        vm.serializeAddress(obj, "deployer", deployer);
        string memory json = vm.serializeAddress(obj, "BountyEscrow", address(escrow));
        vm.writeJson(json, out);
    }
}
