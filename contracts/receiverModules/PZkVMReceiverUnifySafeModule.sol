// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "./BaseReceiverUnifySafeModule.sol";
import "../interfaces/polygonZkEVM/IBridgeMessageReceiver.sol";

contract PZkVMReceiverUnifySafeModule is
    BaseReceiverUnifySafeModule,
    IBridgeMessageReceiver
{
    address public immutable polygonZkEVMBridge;

    constructor(
        GnosisSafe safe_,
        address originSender_,
        address polygonZkEVMBridge_
    ) payable BaseReceiverUnifySafeModule(safe_, originSender_) {
        polygonZkEVMBridge = polygonZkEVMBridge_;
    }

    function onMessageReceived(
        address originAddress_,
        uint32 originNetwork_,
        bytes memory data_
    ) external payable override {
        require(
            msg.sender == polygonZkEVMBridge,
            "onMessageReceived: Not PolygonZkEVMBridge"
        );

        require(originNetwork_ == 0, "onMessageReceived: Not from L1");

        (address[] memory newOwners, uint256 threshold) = abi.decode(
            data_,
            (address[], uint256)
        );

        _receiveSettingUpdates(newOwners, threshold);
    }
}
