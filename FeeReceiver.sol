/**
 *Submitted for verification at Etherscan.io on 2025-10-31
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FaciFeeReciever
 * @notice Handles payments via EIP-3009-compatible tokens (e.g. USDC, JPYC)
 *         Splits incoming amount between merchant and facilitator treasury.
 */
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract FaciFeeReciever {
    address public immutable facilitatorTreasury;

    event Settled(
        address indexed token,
        address indexed payer,
        address indexed merchant,
        uint256 totalAmount,
        uint256 feeAmount
    );

    constructor(address _facilitatorTreasury) {
        require(_facilitatorTreasury != address(0), "invalid facilitator");
        facilitatorTreasury = _facilitatorTreasury;
    }

    /**
     * @notice Called by facilitator to settle a user's payment for a given token.
     * The token must support `receiveWithAuthorization` (EIP-3009).
     */
    function settleWithAuthorization(
        address token,
        address payer,
        address merchant,
        uint256 totalAmount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(token != address(0), "invalid token");
        require(merchant != address(0), "invalid merchant");
        require(totalAmount > 0, "invalid amount");

        // Pull tokens using EIP-3009 authorization
        IERC3009(token).receiveWithAuthorization(
            payer,
            address(this),
            totalAmount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Compute fee: max(0.01, 0.3%)
        uint256 fee = (totalAmount * 3) / 1000; // 0.3%
        uint256 minFee = 10 ** 4; // 0.01 assuming 6 decimals
        if (fee < minFee) fee = minFee;

        uint256 merchantAmount = totalAmount - fee;

        // Transfers using ERC20 standard interface
        require(
            IERC20(token).transfer(facilitatorTreasury, fee),
            "fee transfer failed"
        );
        require(
            IERC20(token).transfer(merchant, merchantAmount),
            "merchant transfer failed"
        );

        emit Settled(token, payer, merchant, totalAmount, fee);
    }
}