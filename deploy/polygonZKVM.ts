import type { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";

module.exports = async function (hre: HardhatRuntimeEnvironment) {
  const deployer = (await hre.ethers.getSigners())[0].address;

  if (hre.network.name !== "polygonZKEVM") {
    throw new Error(
      "This deployment script should only be used on Polygon ZKVM"
    );
  }

  const safeSingelton = await hre.deployments.deploy("GnosisSingleton", {
    from: deployer,
    contract: "GnosisSafe",
    args: [],
    log: true,
    autoMine: true,
    waitConfirmations: 1,
  });

  const factory = await hre.deployments.deploy("ZKEVMFactory", {
    from: deployer,
    contract: "UniversalFactory",
    args: [safeSingelton.address, "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7"],
    log: true,
    autoMine: true,
    waitConfirmations: 1,
  });

  let testState: any = {};
  try {
    testState = JSON.parse(
      fs.readFileSync("./test/test-state.json").toString()
    );
  } catch (err) {}

  testState.polygonZKVMFactory = factory.address;

  fs.writeFileSync(
    "./test/test-state.json",
    JSON.stringify(testState, null, 2)
  );
};

module.exports.tags = ["polygonZKEVM"];
