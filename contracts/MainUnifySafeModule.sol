// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/libraries/CreateCall.sol";
import "./receiverModules/MantleReceiverUnifySafeModule.sol";
import "./interfaces/polygonZkEVM/IPolygonZkEVMBridge.sol";
import "./interfaces/linea/IMessageService.sol";

import {ICrossDomainMessenger} from "@mantleio/contracts/libraries/bridge/ICrossDomainMessenger.sol";
import "./interfaces/linea/MessageServiceBase.sol";

contract MainUnifySafeModule {
    GnosisSafe public safe;

    IPolygonZkEVMBridge public polygonZkEVMBridge;

    address public polygonZkEVMReceiverModule;

    constructor(
        GnosisSafe safe_,
        IPolygonZkEVMBridge polygonZkEVMBridge_,
        address polygonZkEVMReceiverModule_
    ) payable {
        safe = safe_;

        polygonZkEVMBridge = polygonZkEVMBridge_;
        polygonZkEVMReceiverModule = polygonZkEVMReceiverModule_;
    }

    function upgradeSettings() public {
        address[] memory owners = safe.getOwners();
        uint threshold = safe.getThreshold();

        if (address(polygonZkEVMBridge) != address(0x00)) {
            polygonZkEVMBridge.bridgeMessage(
                1, //zkEVM
                polygonZkEVMReceiverModule,
                true, // fast bridge
                abi.encode(owners, threshold)
            );
        }

        /*if (address(lineaBridge) != address(0x00)) {
            lineaBridge.sendMessage(
                lineaReceiverModule,
                5000000, //TODO: params,
                abi.encodeWithSelector(
                    MantleReceiverUnifySafeModule
                        .receiveSettingUpdates
                        .selector,
                    owners,
                    threshold
                )
            );
        }*/
    }
}
