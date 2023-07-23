// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

contract BaseReceiverUnifySafeModule {
    GnosisSafe public safe;
    address public originSender;

    constructor(GnosisSafe safe_, address originSender_) payable {
        safe = safe_;
        originSender = originSender_;
    }

    function _receiveSettingUpdates(
        address[] memory newOwners,
        uint threshold
    ) internal {
        address[] memory oldOwners = safe.getOwners();

        address temp = address(0x55555);
        require(
            safe.execTransactionFromModule(
                address(safe),
                0,
                abi.encodeCall(safe.addOwnerWithThreshold, (temp, threshold)),
                Enum.Operation.Call
            ),
            "Add temp owner failed"
        );

        for (uint256 i = 0; i < oldOwners.length; i++) {
            address owner = oldOwners[i];

            require(
                safe.execTransactionFromModule(
                    address(safe),
                    0,
                    abi.encodeCall(safe.removeOwner, (temp, owner, threshold)),
                    Enum.Operation.Call
                ),
                "Remove owner failed"
            );
        }

        for (uint256 i = 0; i < newOwners.length; i++) {
            address owner = newOwners[i];

            require(
                safe.execTransactionFromModule(
                    address(safe),
                    0,
                    abi.encodeCall(
                        safe.addOwnerWithThreshold,
                        (owner, threshold)
                    ),
                    Enum.Operation.Call
                ),
                "Add owner failed"
            );
        }

        require(
            safe.execTransactionFromModule(
                address(safe),
                0,
                abi.encodeCall(
                    safe.removeOwner,
                    (newOwners[0], temp, threshold)
                ),
                Enum.Operation.Call
            ),
            "Remove temp owner failed"
        );
    }
}
