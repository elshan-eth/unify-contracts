// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import {ICrossDomainMessenger} from "@mantleio/contracts/libraries/bridge/ICrossDomainMessenger.sol";
import "./BaseReceiverUnifySafeModule.sol";

contract MantleReceiverUnifySafeModule is BaseReceiverUnifySafeModule {
    address public immutable mantleBridge;

    constructor(
        GnosisSafe safe_,
        address originSender_,
        address mantleBridge_
    ) payable BaseReceiverUnifySafeModule(safe_, originSender_) {
        mantleBridge = mantleBridge_;
    }

    function receiveSettingUpdates(
        address[] calldata newOwners,
        uint threshold
    ) external {
        require(msg.sender == mantleBridge, "Not MantleBridge");

        require(
            ICrossDomainMessenger(mantleBridge).xDomainMessageSender() ==
                originSender,
            "Not originSender"
        );

        _receiveSettingUpdates(newOwners, threshold);
    }
}
