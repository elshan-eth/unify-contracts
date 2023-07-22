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

        for (uint256 i = 0; i < oldOwners.length; i++) {
            address owner = oldOwners[i];
            address prevOwner = address(0x1);
            if (i != 0) {
                prevOwner = oldOwners[i - 1];
            }

            require(
                safe.execTransactionFromModule(
                    address(safe),
                    0,
                    abi.encodeCall(
                        safe.removeOwner,
                        (prevOwner, owner, threshold)
                    ),
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
    }
}
