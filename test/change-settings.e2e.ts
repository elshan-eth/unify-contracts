import { ethers } from "ethers";
import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import fs from "fs";
import { UniversalFactory__factory } from "../typechain-types";
import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { MainUnifySafeModule__factory } from "../typechain-types/factories/contracts";

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

  const lineaWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY!,
    new ethers.providers.JsonRpcProvider(process.env.LINEA_RPC_URL!)
  );

  const ethAdapter = new EthersAdapter({
    ethers: ethers,
    signerOrProvider: ethWallet,
  });

  it("Create a sub account (Polygon ZKVM)", async () => {
    try {
      testState = JSON.parse(
        fs.readFileSync("./test/test-state.json").toString()
      );
    } catch (err) {}

    if (!testState.safeAddress || !testState.polygonZKVMFactory) {
      throw new Error("No test state");
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

    console.log("Creating Linea sub account...");
    /*
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
});
