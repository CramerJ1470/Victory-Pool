const hre = require("hardhat");

async function main() {
  const VPToken = await hre.ethers.getContractFactory("VPToken");
  const token = await VPToken.deploy();
  await token.waitForDeployment();

  const MarketRegistry = await hre.ethers.getContractFactory("MarketRegistry");
  const registry = await MarketRegistry.deploy();
  await registry.waitForDeployment();

  const ParimutuelBetting = await hre.ethers.getContractFactory("VictoryPool");
  const betting = await VictoryPool.deploy(
    await token.getAddress(),
    await registry.getAddress()
  );
  await betting.waitForDeployment();

  console.log("VPT:", await token.getAddress());
  console.log("Registry:", await registry.getAddress());
  console.log("Betting:", await betting.getAddress());
}

main().catch(console.error);
