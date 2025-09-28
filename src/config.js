import dotenv from 'dotenv';
dotenv.config();

export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    // Deployed contracts
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    trueERC20: "0x343d726b4E8cFfbbe615FE1d782f095eaD6D9574",
    limitOrderProtocol: "0xed4A8916209Bf528EC3317755e84138f55624824",
    settlement: "0x9B9B198e2E9e0E789A4B00190302754A6Faa6854",
    escrowFactory: "0xcBcFEe91Bbd4A12533Fc72a3D286B6d86ab2B9D5",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" 
  },  
 
  tron: {
    chainId: 2,
    rpcUrl: "https://api.shasta.trongrid.io",
    fullNode: "https://api.shasta.trongrid.io",
    solidityNode: "https://api.shasta.trongrid.io",
    eventServer: "https://api.shasta.trongrid.io",
    usdc: "TSdZwNqpHofzP6BsBKGQUWdBeJphLmF6id",
    trueERC20:"TWMdGyPMtLj2zW3hgMgDneuVnc7qVwGvJU",
    settlement: "TQJFqP41kqU7RS5ZxkhmQXZbVgUp5gd4EK",
    escrowFactory: "TDSffTVz8BGTgKeTvgHQeWDa2WQxErey7b" // Using Settlement contract as fallback
  }
};

export const RESOLVER_CONFIG = {
  // Resolver account - load from environment variable
  privateKey: process.env.RESOLVER_PRIVATE_KEY || "",
  address: "0xe841d59Bb054b5cf81cF8BEA1b74EcE5A12550F2",
  tronAddress: "TDjWsSyKvT6X8gdfCvVXmJeLQfnQVjz1XS", // Corresponding Tron address
  tronPrivateKey: process.env.TRON_PRIVATE_KEY || "",
  // 1inch Fusion+ Time lock configuration (in seconds)
  timeLocks: {
    // Source chain timelock phases
    srcFinalityLock: 300,        // 5 minutes - wait for finality
    srcPrivateWithdrawal: 600,   // 10 minutes - resolver can withdraw
    srcPublicWithdrawal: 1200,   // 20 minutes - anyone can withdraw
    srcPrivateCancellation: 1800, // 30 minutes - maker can cancel
    srcPublicCancellation: 86400, // 1 day - anyone can cancel for maker
    
    // Destination chain timelock phases  
    dstFinalityLock: 300,        // 5 minutes
    dstPrivateWithdrawal: 600,   // 10 minutes
    dstPublicWithdrawal: 1200,   // 20 minutes
    dstPrivateCancellation: 1800  // 30 minutes
  },
  
  // Safety deposits (in wei for native tokens, wei equivalent for ERC20)
  safetyDeposit: {
    src: "1000000000000000000", // 1 ETH equivalent
    dst: "1000000000000000000"  // 1 ETH equivalent
  },
  
  // Server configuration
  port: 3001,
  
  // Gas configuration
  gasLimits: {
    escrowCreation: 800000,
    secretReveal: 200000,
    withdrawal: 150000,
    cancellation: 150000
  },
  
  // Dutch auction configuration
  auction: {
    startTime: 0, // Immediate start
    duration: 1800, // 30 minutes
    initialRateBump: 10000, // 100% initial premium (in basis points)
    finalRateBump: 0 // No premium at end
  }
};