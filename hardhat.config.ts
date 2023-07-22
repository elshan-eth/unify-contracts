import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import "hardhat-tracer";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    hardhat: {},
    mantel: {
      url: "https://rpc.testnet.mantle.xyz",
      accounts: [process.env.PRIVATE_KEY!],
      saveDeployments: true,
    },
    polygonZKEVM: {
      url: process.env.PZKEVM_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!],
      saveDeployments: true,
    },
    linea: {
      url: process.env.LINEA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!],
      saveDeployments: true,
    },
  },
};

module.exports = config;
