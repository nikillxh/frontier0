// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Minimal subset of the Foundry cheatcode interface so the test suite has no
///      external (network/submodule) dependency on forge-std.
interface Vm {
    function deal(address who, uint256 newBalance) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function addr(uint256 privateKey) external pure returns (address);
    function label(address account, string calldata newLabel) external;
}

/// @title MiniTest
/// @notice Tiny test base: cheatcode handle + hard-revert assertions (a failed assert
///         reverts, which Forge reports as a failing test).
abstract contract MiniTest {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function assertTrue(bool cond, string memory err) internal pure {
        require(cond, err);
    }

    function assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(address a, address b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(bool a, bool b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertGt(uint256 a, uint256 b, string memory err) internal pure {
        require(a > b, err);
    }

    function assertGe(uint256 a, uint256 b, string memory err) internal pure {
        require(a >= b, err);
    }

    function assertLt(uint256 a, uint256 b, string memory err) internal pure {
        require(a < b, err);
    }
}
