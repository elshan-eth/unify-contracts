import type { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";

module.exports = async function (hre: HardhatRuntimeEnvironment) {
  const deployer = (await hre.ethers.getSigners())[0].address;

  if (hre.network.name !== "linea") {
    throw new Error("This deployment script should only be used on Linea");
  }

  const factory = await hre.deployments.deploy("LineaFactory", {
    from: deployer,
    contract: "UniversalFactory",
    args: [
      "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
      "0xC499a572640B64eA1C8c194c43Bc3E19940719dC",
    ],
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

  testState.lineaFactory = factory.address;

  fs.writeFileSync(
    "./test/test-state.json",
    JSON.stringify(testState, null, 2)
  );
};

module.exports.tags = ["linea"];
