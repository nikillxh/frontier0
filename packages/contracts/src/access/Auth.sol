// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Auth
/// @notice Minimal owner + operator access control shared across FRONTIER0 contracts.
/// @dev The "operator" is the BountyEscrow market, authorized to mutate stake and reputation.
abstract contract Auth {
    address public owner;
    mapping(address => bool) public isOperator;

    error NotOwner();
    error NotOperator();
    error ZeroAddress();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorSet(address indexed operator, bool allowed);

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (!isOperator[msg.sender] && msg.sender != owner) revert NotOperator();
        _;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
