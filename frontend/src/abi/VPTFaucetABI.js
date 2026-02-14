export const VPTFaucetAbi = [
  { type: "function", name: "hasClaimed", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },

  { type: "function", name: "claim100", stateMutability: "nonpayable",
    inputs: [], outputs: [] },

  { type: "function", name: "buy50WithEth", stateMutability: "payable",
    inputs: [], outputs: [] },

  { type: "function", name: "buy50WithLink", stateMutability: "nonpayable",
    inputs: [], outputs: [] },

  { type: "function", name: "ethPriceWei", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },

  { type: "function", name: "linkPriceWei", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];
