const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function deploymentsPath(networkName) {
  return path.join(__dirname, "..", "deployments", `${networkName}.json`);
}

function readDeployments(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeDeployments(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const json = JSON.stringify(
    data,
    (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    2
  );

  fs.writeFileSync(filePath, json);
}


async function isDeployed(address) {
  if (!address) return false;
  const code = await hre.ethers.provider.getCode(address);
  return code && code !== "0x";
}

async function deployOrAttach({ key, factoryName, deployments, filePath, args = [] }) {
  // If we have an address saved and code exists, attach.
  const saved = deployments[key]?.address;
  if (saved && (await isDeployed(saved))) {
    console.log(`✅ Using existing ${key}:`, saved);
    const Factory = await hre.ethers.getContractFactory(factoryName);
    return Factory.attach(saved);
  }

  // Otherwise deploy new.
  console.log(`🚀 Deploying ${key}...`);
  const Factory = await hre.ethers.getContractFactory(factoryName);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Deployed ${key}:`, address);

  deployments[key] = {
    address,
    factoryName,
    args,
    deployedAt: new Date().toISOString(),
  };
  writeDeployments(filePath, deployments);

  return contract;
}

async function main() {
  const networkName = hre.network.name; // "sepolia" if you run with --network sepolia
  const filePath = deploymentsPath(networkName);
  const deployments = readDeployments(filePath);

  const [deployer] = await hre.ethers.getSigners();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log("========================================");
  console.log("Network:", networkName, "ChainId:", chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Deployments file:", filePath);
  console.log("========================================\n");

  // -----------------------------
  // 1) VPToken
  // -----------------------------
  const token = await deployOrAttach({
    key: "VPToken",
    factoryName: "VPToken",
    deployments,
    filePath,
  });

  // -----------------------------
  // 2) MarketRegistry
  // -----------------------------
  const registry = await deployOrAttach({
    key: "MarketRegistry",
    factoryName: "MarketRegistry",
    deployments,
    filePath,
  });

  // -----------------------------
  // 3) VictoryPool (needs token + registry)
  // -----------------------------
  const tokenAddress = await token.getAddress();
  const registryAddress = await registry.getAddress();

  const betting = await deployOrAttach({
    key: "VictoryPool",
    factoryName: "VictoryPool",
    deployments,
    filePath,
    args: [tokenAddress, registryAddress],
  });

  // -----------------------------
  // 4) VPTFaucet (needs token + LINK + prices)
  // -----------------------------
  const LINK = process.env.SEPOLIA_LINK_ADDRESS; // REQUIRED for LINK purchases
  if (!LINK) {
    console.log("⚠️ SEPOLIA_LINK_ADDRESS not set. Faucet will still deploy, but LINK purchase won't work until updated.");
  }

  const ethPriceStr = process.env.FAUCET_ETH_PRICE || "0.001";
  const linkPriceStr = process.env.FAUCET_LINK_PRICE || "1";
  const fundVptStr = process.env.FAUCET_FUND_VPT || "1000000";

  const ethPriceWei = hre.ethers.parseEther(ethPriceStr);
  const linkPriceWei = hre.ethers.parseUnits(linkPriceStr, 18);

  const faucet = await deployOrAttach({
    key: "VPTFaucet",
    factoryName: "VPTFaucet",
    deployments,
    filePath,
    args: [tokenAddress, LINK || hre.ethers.ZeroAddress, ethPriceWei, linkPriceWei],
  });

  const faucetAddress = await faucet.getAddress();

  // -----------------------------
  // 5) Fund faucet with VPT (idempotent)
  //    Only mint if faucet balance < target
  // -----------------------------
  const targetFaucetBalance = hre.ethers.parseUnits(fundVptStr, 18);
  const currentFaucetBalance = await token.balanceOf(faucetAddress);

  if (currentFaucetBalance >= targetFaucetBalance) {
    console.log(`✅ Faucet already funded: ${currentFaucetBalance.toString()} (>= target ${targetFaucetBalance.toString()})`);
  } else {
    const needed = targetFaucetBalance - currentFaucetBalance;
    console.log(`🚰 Funding faucet. Current: ${currentFaucetBalance.toString()} Target: ${targetFaucetBalance.toString()}`);
    console.log(`➡️ Minting additional: ${needed.toString()} VPT to faucet...`);

    // This requires deployer to be VPToken owner (your VPToken uses Ownable(msg.sender))
    const tx = await token.mint(faucetAddress, needed);
    await tx.wait();
    console.log("✅ Faucet funded.");
  }

  // Save some convenience values too
  deployments.meta = {
    network: networkName,
    chainId: chainId.toString(),
    lastRunAt: new Date().toISOString(),
    deployer: deployer.address,
    token: tokenAddress,
    registry: registryAddress,
    pool: await betting.getAddress(),
    faucet: faucetAddress,
    link: LINK || hre.ethers.ZeroAddress,
    faucetPrices: {
      ethPriceWei: ethPriceWei.toString(),
      linkPriceWei: linkPriceWei.toString(),
    },
  };
  writeDeployments(filePath, deployments);

  console.log("\n✅ Done. Summary:");
  console.log("VPToken      :", tokenAddress);
  console.log("MarketRegistry:", registryAddress);
  console.log("VictoryPool  :", await betting.getAddress());
  console.log("VPTFaucet    :", faucetAddress);
  console.log("LINK         :", LINK || "NOT SET");
  console.log("\nSaved to:", filePath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
