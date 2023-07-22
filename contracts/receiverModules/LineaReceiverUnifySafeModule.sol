// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "../interfaces/linea/IMessageService.sol";
import "./BaseReceiverUnifySafeModule.sol";

contract LineaReceiverUnifySafeModule is BaseReceiverUnifySafeModule {
    address public immutable lineaBridge;

    constructor(
        GnosisSafe safe_,
        address originSender_,
        address lineaBridge_
    ) payable BaseReceiverUnifySafeModule(safe_, originSender_) {
        lineaBridge = lineaBridge_;
    }

    function receiveSettingUpdates(
        address[] calldata newOwners,
        uint threshold
    ) external {
        require(msg.sender == lineaBridge, "Not MantleBridge");

        require(
            IMessageService(lineaBridge).sender() == originSender,
            "Not originSender"
        );

        _receiveSettingUpdates(newOwners, threshold);
    }
}
