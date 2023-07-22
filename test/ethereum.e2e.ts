import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import Safe, {
  SafeFactory,
  EthersAdapter,
  SafeAccountConfig,
} from "@safe-global/protocol-kit";

dotenv.config();

describe("Ethereum e2e (testnet)", function () {
  let testState: {
    safeAddress: string | undefined;
    polygonZKVMFactory: string | undefined;
    lineaFactory: string | undefined;
  } = {
    safeAddress: undefined,
    polygonZKVMFactory: undefined,
    lineaFactory: undefined,
  };

  try {
    testState = JSON.parse(
      fs.readFileSync("./test/test-state.json").toString()
    );
  } catch (err) {}

  it("Create a main safe account", async () => {
    if (testState.safeAddress) {
      console.log("Safe account already exists");
      return;
    }

    const wallet = new ethers.Wallet(
      process.env.PRIVATE_KEY!,
      new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL!)
    );

    const ethAdapter = new EthersAdapter({
      ethers: ethers,
      signerOrProvider: wallet,
    });

    const safeFactory = await SafeFactory.create({
      ethAdapter: ethAdapter,
    });

    const safeAccountConfig: SafeAccountConfig = {
      owners: [wallet.address],
      threshold: 1,
    };

    console.log("Creating safe account...");
    const safeSdk: Safe = await safeFactory.deploySafe({
      safeAccountConfig,
      saltNonce: (await wallet.getTransactionCount()).toString(),
    });
    const address = await safeSdk.getAddress();

    console.log("Safe address: ", address);

    testState.safeAddress = address;
    fs.writeFileSync(
      "./test/test-state.json",
      JSON.stringify(testState, null, 2)
    );
  });
});
