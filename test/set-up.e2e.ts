import { ethers } from "ethers";
import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import fs from "fs";
import {
  IPolygonZkEVMBridge__factory,
  PZkVMReceiverUnifySafeModule__factory,
  UniversalFactory__factory,
} from "../typechain-types";
import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { MainUnifySafeModule__factory } from "../typechain-types/factories/contracts";
import axios from "axios";

export enum TaskState {
  CheckPending = "CheckPending",
  ExecPending = "ExecPending",
  ExecSuccess = "ExecSuccess",
  ExecReverted = "ExecReverted",
  WaitingForConfirmation = "WaitingForConfirmation",
  Blacklisted = "Blacklisted",
  Cancelled = "Cancelled",
  NotFound = "NotFound",
}

interface PolygonBridgeResponse {
  deposits: Deposit[];
  total_cnt: string;
}

interface Deposit {
  leaf_type: number;
  orig_net: number;
  orig_addr: string;
  amount: string;
  dest_net: number;
  dest_addr: string;
  block_num: string;
  deposit_cnt: string;
  network_id: number;
  tx_hash: string;
  claim_tx_hash: string;
  metadata: string;
  ready_for_claim: boolean;
}

export const waitRelayerTX = async (
  gelatoRelay: GelatoRelay,
  taskId: string
) => {
  let relayerTx;
  while (true) {
    relayerTx = await gelatoRelay.getTaskStatus(taskId);
    if (
      relayerTx!.taskState === TaskState.ExecSuccess ||
      relayerTx!.taskState === TaskState.WaitingForConfirmation
    ) {
      break;
    } else {
      switch (relayerTx!.taskState) {
        case TaskState.ExecReverted:
        case TaskState.Blacklisted:
        case TaskState.Cancelled:
        case TaskState.NotFound:
          throw new Error(`Relayer tx failed ${relayerTx!.taskState}`);
      }
    }
  }

  return relayerTx!.transactionHash!;
};

describe("Set-up subs e2e", function () {
  let testState: {
    safeAddress: string | undefined;
    polygonZKVMFactory: string | undefined;
    lineaFactory: string | undefined;
    mainModule: string | undefined;
    polygonZKVMReceiverModule: string | undefined;
    lineaReceiverModule: string | undefined;
  } = {
    safeAddress: undefined,
    polygonZKVMFactory: undefined,
    lineaFactory: undefined,
    mainModule: undefined,
    polygonZKVMReceiverModule: undefined,
    lineaReceiverModule: undefined,
  };

  const ethWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY!,
    new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL!)
  );

  const pZkEVMWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY!,
    new ethers.providers.JsonRpcProvider(process.env.PZKEVM_RPC_URL!)
  );

  const ethAdapter = new EthersAdapter({
    ethers: ethers,
    signerOrProvider: ethWallet,
  });

  it("Instal module", async () => {
    try {
      testState = JSON.parse(
        fs.readFileSync("./test/test-state.json").toString()
      );
    } catch (err) {}

    if (!testState.safeAddress || !testState.polygonZKVMFactory) {
      throw new Error("No test state");
    }

    if (testState.mainModule) {
      console.log("Main module already deployed");
      return;
    }

    const safe = await Safe.create({
      ethAdapter,
      safeAddress: testState.safeAddress!,
    });

    console.log("Creating polygon ZKEVM sub account...");

    const { data } = await UniversalFactory__factory.connect(
      testState.polygonZKVMFactory!,
      pZkEVMWallet
    ).populateTransaction.deploy(
      await safe.getAddress(),
      await safe.getOwners(),
      await safe.getThreshold()
    );

    const gelatoRelay = new GelatoRelay();

    const pzkEVMRelayResponse = await gelatoRelay.sponsoredCall(
      {
        chainId: await pZkEVMWallet.getChainId(),
        target: testState.polygonZKVMFactory!,
        data: data!,
      },
      process.env.GELATO_RELAY_PZKEVM_KEY!
    );

    const pzkEVMTxHash = await waitRelayerTX(
      gelatoRelay,
      pzkEVMRelayResponse.taskId
    );

    /*
    console.log("Creating Linea sub account...");

    const lineaRelayResponse = await gelatoRelay.sponsoredCall(
      {
        chainId: await lineaWallet.getChainId(),
        target: testState.lineaFactory!,
        data: data!,
      },
      process.env.GELATO_RELAY_LINEA_KEY!
    );

    const lineaTxHash = await waitRelayerTX(
      gelatoRelay,
      lineaRelayResponse.taskId
    );*/

    const pzkEVMTx = await pZkEVMWallet.provider!.getTransactionReceipt(
      pzkEVMTxHash
    );

    const deployedTopic =
      UniversalFactory__factory.createInterface().getEventTopic("Deployed");
    pzkEVMTx.logs.map((log) => {
      if (log.topics[0] === deployedTopic) {
        const parsedLog =
          UniversalFactory__factory.createInterface().parseLog(log);

        testState.polygonZKVMReceiverModule = parsedLog.args[1];
      }
    });
    /*
    const lineaTx = await lineaWallet.provider!.getTransactionReceipt(
      lineaTxHash
    );
    lineaTx.logs.map((log) => {
      if (log.topics[0] === deployedTopic) {
        const parsedLog =
          UniversalFactory__factory.createInterface().parseLog(log);

        testState.polygonZKVMReceiverModule = parsedLog.args[1];
      }
    });*/

    console.log("Creating main module...");

    const mainModule = await new MainUnifySafeModule__factory(ethWallet).deploy(
      await safe.getAddress(),
      "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7",
      testState.polygonZKVMReceiverModule!
    );
    const tx = await safe.createEnableModuleTx(mainModule.address);

    await safe.signTransaction(tx);
    await safe.executeTransaction(tx);

    testState.mainModule = mainModule.address;
    fs.writeFileSync(
      "./test/test-state.json",
      JSON.stringify(testState, null, 2)
    );

    /*
    const deployLineaTx = await LineaFactory__factory.connect(
      pZkEVMWallet.address,
      pZkEVMWallet
    ).deploy(await safe.getOwners(), await safe.getThreshold());

    await deployLineaTx.wait();*/

    /*

     (
          await IPolygonZkEVMBridge__factory.connect(
            "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7",
            pZkEVMWallet
          ).populateTransaction.bridgeMessage(
            1,
            testState.polygonZKVMFactory!,
            true,
            ethers.utils.defaultAbiCoder.encode(
              ["address[]", "uint256"],
              [[pZkEVMWallet.address], 1]
            )
          )
        ).data!,
        */
  }).timeout(50000);

  it("Test mock", async () => {
    const tx = await PZkVMReceiverUnifySafeModule__factory.connect(
      testState.polygonZKVMReceiverModule!,
      pZkEVMWallet
    ).onMessageReceived(
      testState.mainModule!,
      0,
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000085fbc7b5087cc7b4fe3fe97755d8e01c9fd727d9"
    );

    await tx.wait();
  }).timeout(50000);
  /*
  it("Cross-chain test", async () => {
   
    const tx = await MainUnifySafeModule__factory.connect(
      testState.mainModule!,
      ethWallet
    ).upgradeSettings();
    await tx.wait();
    await new Promise((resolve) => setTimeout(resolve, 5000));


    const zkBridgeResponse = await axios.get(
      `https://bridge-api.public.zkevm-test.net/bridges/${testState.polygonZKVMReceiverModule}`
    );

    const polygonBridgeResponse: PolygonBridgeResponse = zkBridgeResponse.data;

    console.log(polygonBridgeResponse);
    for (const deposit of polygonBridgeResponse.deposits) {
      if (!deposit.ready_for_claim) {
        continue;
      }

      const proofAxios = await axios.get(
        `https://bridge-api.public.zkevm-test.net/merkle-proof`,
        {
          params: {
            deposit_cnt: deposit.deposit_cnt,
            net_id: deposit.orig_net,
          },
        }
      );

      const { proof } = proofAxios.data;
      const claimTx = await IPolygonZkEVMBridge__factory.connect(
        "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7",
        pZkEVMWallet
      ).claimMessage(
        proof.merkle_proof,
        deposit.deposit_cnt,
        proof.main_exit_root,
        proof.rollup_exit_root,
        deposit.orig_net,
        deposit.orig_addr,
        deposit.dest_net,
        deposit.dest_addr,
        deposit.amount,
        deposit.metadata
      );

      await claimTx.wait();
    }
  }).timeout(50000);*/
});
