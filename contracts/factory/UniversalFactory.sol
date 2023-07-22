// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";
import "../receiverModules/PZkVMReceiverUnifySafeModule.sol";
import "../receiverModules/LineaReceiverUnifySafeModule.sol";
import "../interfaces/linea/IMessageService.sol";

contract UniversalFactory {
    GnosisSafe public immutable safeSingleton;
    address public immutable bridge;

    event Deployed(address subSafe, address receiverModule);

    constructor(GnosisSafe safeSingleton_, address bridge_) payable {
        safeSingleton = safeSingleton_;
        bridge = bridge_;
    }

    function initializeSubSafe(address module) external {
        GnosisSafe subSafe = GnosisSafe(payable(address(this)));

        subSafe.enableModule(module);
    }

    // TODO: add security checks
    function deploy(
        address originSafe,
        address[] calldata owners,
        uint threshold
    ) external {
        GnosisSafe subSafe = GnosisSafe(
            payable(
                Create2.deploy(
                    0,
                    keccak256(abi.encodePacked(block.number)), // salt: keccak256(abi.encodePacked(originSafe)),
                    abi.encodePacked(
                        type(GnosisSafeProxy).creationCode,
                        uint256(uint160(address(safeSingleton)))
                    )
                )
            )
        );

        address receiverModule;
        if (block.chainid == 59140) {
            LineaReceiverUnifySafeModule module = new LineaReceiverUnifySafeModule(
                    subSafe,
                    originSafe,
                    bridge
                );

            receiverModule = address(module);
        } else if (block.chainid == 1442) {
            PZkVMReceiverUnifySafeModule module = new PZkVMReceiverUnifySafeModule(
                    subSafe,
                    originSafe,
                    bridge
                );
            receiverModule = address(module);
        } else {
            revert("Unsupported chain");
        }

        subSafe.setup(
            owners,
            threshold,
            address(this),
            abi.encodeCall(
                UniversalFactory.initializeSubSafe,
                (receiverModule)
            ),
            address(0),
            address(0),
            0,
            payable(address(0))
        );

        emit Deployed(address(subSafe), receiverModule);
    }
}
