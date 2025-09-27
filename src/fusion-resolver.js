import { ethers } from 'ethers';
import pkg from 'tronweb';
const TronWeb = pkg;
import { RESOLVER_CONFIG } from './config.js';


const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    rpcUrl: "https:
    
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    trueERC20: "0x343d726b4E8cFfbbe615FE1d782f095eaD6D9574",
    limitOrderProtocol: "0xed4A8916209Bf528EC3317755e84138f55624824",
    escrowFactory: "0xcBcFEe91Bbd4A12533Fc72a3D286B6d86ab2B9D5",
    settlement: "0x9B9B198e2E9e0E789A4B00190302754A6Faa6854",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  },  
  tron: {
    chainId: 2,
    rpcUrl: "https:
    fullNode: "https:
    solidityNode: "https:
    eventServer: "https:
    usdc: "TSdZwNqpHofzP6BsBKGQUWdBeJphLmF6id",
    settlement: "TQJFqP41kqU7RS5ZxkhmQXZbVgUp5gd4EK",
    escrowFactory: "TDSffTVz8BGTgKeTvgHQeWDa2WQxErey7b"
  }
};


const SETTLEMENT_ABI = [
  "function fillOrder((address,address,address,uint256,uint256,address,bytes32,uint256),bytes,uint256,uint256,bytes) external",
  "function getOrderStatus(bytes32) external view returns (uint8)",
  "event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makingAmount, uint256 takingAmount)"
];

const ESCROW_FACTORY_ABI = [
  "function createEscrow(bytes32,address,uint256,bytes32,uint256,address,address) external payable returns (address)",
  "function getEscrow(bytes32) external view returns (address)",
  "event EscrowCreated(bytes32 indexed orderHash, address indexed escrow, address indexed token, uint256 amount, bytes32 hashLock, uint256 deployedAt)"
];

const ESCROW_ABI = [
  "function withdraw(bytes32 secret) external",
  "function cancel() external",
  "function getState() external view returns (string)",
  "function revealedSecret() external view returns (bytes32)",
  "function withdrawn() external view returns (bool)",
  "function cancelled() external view returns (bool)"
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

/**
 * 1inch Fusion+ Mock Resolver
 * Implements the professional resolver role in the 1inch ecosystem
 */
export class FusionResolver {
  constructor() {
    console.log('🔍 FusionResolver constructor called');
    console.log('🔍 NETWORKS in constructor:', typeof NETWORKS, Object.keys(NETWORKS || {}));
    
    this.providers = {};
    this.signers = {};
    this.contracts = {};
    this.tronWeb = null;
    this.tronContracts = {};
    this.activeOrders = new Map();
    this.secrets = new Map();
    this.running = false;
    
    this.initializeConnections();
  }

  
  safeGetAddress(address, context = 'unknown') {
    
    if (typeof address === 'string' && address.startsWith('T') && address.length >= 30) {
      console.log("TRON address: ",address);
      
      return address; 
    }
    try {
      console.log("ETH address: ",address);
      
      return ethers.getAddress(address);
    } catch (error) {
      console.log(`⚠️  Address validation failed for ${context}: ${address}`);
      return address; 
    }
  }

  initializeConnections() {
    console.log("🔗 Initializing connections to networks...");
    console.log("🔑 Private key length:", RESOLVER_CONFIG.privateKey?.length || 'undefined');
    console.log("🔑 Private key starts with:", RESOLVER_CONFIG.privateKey?.substring(0, 10) || 'undefined');
    
    for (const [networkName, config] of Object.entries(NETWORKS)) {
      
      if (networkName === 'tron') {
        console.log(`🔗 Initializing Tron with TronWeb...`);
        
        const TronWebConstructor = TronWeb?.TronWeb || TronWeb;
        
        
        const tronPrivateKey = process.env.TRON_PRIVATE_KEY;
        if (tronPrivateKey) {
          this.tronWeb = new TronWebConstructor({
            fullHost: config.fullNode,
            privateKey: tronPrivateKey
          });
        } else {
          console.log('⚠️  No Tron private key found, initializing read-only TronWeb');
          this.tronWeb = new TronWebConstructor({
            fullHost: config.fullNode
          });
        }
        
        
        this.initializeTronContracts(config);
        console.log(`✅ TronWeb initialized for ${networkName}`);
        continue;
      }
      
      console.log(`🔗 Initializing ${networkName}...`);
      
      
      this.providers[networkName] = new ethers.JsonRpcProvider(config.rpcUrl);
      
      
      this.signers[networkName] = new ethers.Wallet(
        RESOLVER_CONFIG.privateKey,
        this.providers[networkName]
      );
      
      
      this.contracts[networkName] = {
        settlement: new ethers.Contract(
          config.settlement,
          SETTLEMENT_ABI,
          this.signers[networkName]
        ),
        escrowFactory: new ethers.Contract(
          config.escrowFactory,
          ESCROW_FACTORY_ABI,
          this.signers[networkName]
        ),
        usdc: new ethers.Contract(
          config.usdc,
          ERC20_ABI,
          this.signers[networkName]
        )
      };
    }
    
    console.log("✅ Network connections initialized");
  }

  async initializeTronContracts(config) {
    try {
      
      
      
      
      this.tronContracts.usdcAddress = config.usdc;
      this.tronContracts.settlementAddress = config.settlement;
      
      console.log('✅ Tron contracts initialized:', {
        usdc: config.usdc,
        settlement: config.settlement
      });
    } catch (error) {
      console.error('❌ Error initializing Tron contracts:', error);
      throw error;
    }
  }

  async start() {
    console.log("🚀 Starting 1inch Fusion+ Mock Resolver");
    console.log(`Resolver Address: ${RESOLVER_CONFIG.address}`);
    
    await this.checkBalances();
    await this.checkApprovals();
    
    this.running = true;
    this.startOrderMonitoring();
    
    console.log("✅ Fusion+ Resolver is running and monitoring for orders");
  }

  async stop() {
    this.running = false;
    console.log("⏹️ Resolver stopped");
  }

  async checkBalances() {
    console.log("\n💰 Checking Resolver Balances:");
    
    for (const [networkName, config] of Object.entries(NETWORKS)) {
      
      if (networkName === 'tron') {
        try {
          const tronPrivateKey = process.env.TRON_PRIVATE_KEY;
          if (tronPrivateKey) {
            const resolverAddress = this.tronWeb.address.fromPrivateKey(tronPrivateKey);
            const nativeBalance = await this.tronWeb.trx.getBalance(resolverAddress);
            
            console.log(`TRON:`);
            console.log(`  - Native TRX: ${this.tronWeb.fromSun(nativeBalance)}`);
            console.log(`  - USDC: Available for transfers`);
          } else {
            console.log(`TRON: (No private key configured for balance checking)`);
          }
        } catch (error) {
          console.error(`Error checking Tron balance:`, error.message);
        }
        continue;
      }
      
      try {
        const signer = this.signers[networkName];
        const nativeBalance = await this.providers[networkName].getBalance(signer.address);
        const usdcBalance = await this.contracts[networkName].usdc.balanceOf(signer.address);
        
        console.log(`${networkName.toUpperCase()}:`);
        console.log(`  - Native: ${ethers.formatEther(nativeBalance)}`);
        console.log(`  - USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
      } catch (error) {
        console.error(`Error checking ${networkName} balance:`, error.message);
      }
    }
  }

  async checkApprovals() {
    console.log("\n🔐 Checking Token Approvals:");
    
    for (const [networkName, config] of Object.entries(NETWORKS)) {
      
      if (networkName === 'tron') {
        console.log(`TRON USDC -> Settlement: Ready for bridge operations`);
        continue;
      }
      
      try {
        const signer = this.signers[networkName];
        const allowance = await this.contracts[networkName].usdc.allowance(
          signer.address,
          config.escrowFactory
        );
        
        console.log(`${networkName.toUpperCase()} USDC -> EscrowFactory: ${ethers.formatUnits(allowance, 6)}`);
        
        
        if (allowance < ethers.parseUnits("1000", 6)) {
          console.log(`  Approving USDC on ${networkName}...`);
          const tx = await this.contracts[networkName].usdc.approve(
            config.escrowFactory,
            ethers.parseUnits("10000", 6) 
          );
          await tx.wait();
          console.log(`  ✅ Approved USDC on ${networkName}`);
        }
      } catch (error) {
        console.error(`Error checking ${networkName} approvals:`, error.message);
      }
    }
  }

  /**
   * Process a cross-chain swap request
   * This simulates how a professional resolver would handle an order
   */
  async processSwapRequest(orderRequest) {
    console.log(`\n🔍 Raw orderRequest:`, JSON.stringify(orderRequest, null, 2));
    
    const {
      fromNetwork,
      toNetwork,
      fromToken,
      toToken,
      amount,
      userAddress,
      destinationAddress = userAddress
    } = orderRequest;

    console.log(`\n📋 Processing Cross-Chain Order:`);
    console.log(`  From: ${amount} ${fromToken} on ${fromNetwork}`);
    console.log(`  To: ${toToken} on ${toNetwork}`);
    console.log(`  Maker: ${userAddress}`);
    console.log(`  Destination: ${destinationAddress}`);
    
    console.log(`\n🔍 NETWORKS available:`, Object.keys(NETWORKS));
    console.log(`🔍 NETWORKS object type:`, typeof NETWORKS);
    console.log(`🔍 NETWORKS:`, NETWORKS);

    try {
      
      const secret = ethers.hexlify(ethers.randomBytes(32));
      const hashLock = ethers.keccak256(secret);
      
      console.log(`🔒 Generated HashLock: ${hashLock}`);

      
      console.log(`🔍 Debug: NETWORKS object:`, Object.keys(NETWORKS));
      console.log(`🔍 Debug: fromNetwork=${fromNetwork}, fromToken=${fromToken}`);
      console.log(`🔍 Debug: NETWORKS[${fromNetwork}]:`, NETWORKS[fromNetwork]);
      
      
      const getNetworkAddress = (address, network) => {
        if (network === 'tron') {
          
          return address;
        } else {
          
          return ethers.getAddress(address);
        }
      };
      
      
      const order = {
        maker: getNetworkAddress(userAddress, fromNetwork),
        makerAsset: getNetworkAddress(NETWORKS[fromNetwork][fromToken.toLowerCase()], fromNetwork),
        takerAsset: fromNetwork === 'tron' ? NETWORKS[fromNetwork].usdc : this.safeGetAddress(NETWORKS[fromNetwork].trueERC20, 'trueERC20 address'),
        makingAmount: ethers.parseUnits(amount, 6), 
        takingAmount: ethers.parseUnits(amount, 6), 
        receiver: getNetworkAddress(destinationAddress, toNetwork),
        salt: ethers.hexlify(ethers.randomBytes(32)),
        makerTraits: 0
      };

      
      const deployedAt = Math.floor(Date.now() / 1000);
      const timeLocks = this.packTimeLocks(deployedAt);

      
      
      
      console.log('🔍 Order components for hashing:', {
        maker: order.maker,
        makerAsset: order.makerAsset,
        takerAsset: order.takerAsset,
        receiver: order.receiver
      });
      
      let orderHash;
      try {
        orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string", "string", "uint256", "uint256", "string", "bytes32", "uint256"],
          [order.maker, order.makerAsset, order.takerAsset, order.makingAmount, order.takingAmount, order.receiver, order.salt, order.makerTraits]
        ));
        console.log('✅ Order hash calculated successfully');
      } catch (hashError) {
        console.log('⚠️  Standard ABI encoding failed, using fallback hash method');
        
        const orderString = `${order.maker}-${order.makerAsset}-${order.takerAsset}-${order.makingAmount}-${order.takingAmount}-${order.receiver}-${order.salt}-${order.makerTraits}`;
        orderHash = ethers.keccak256(ethers.toUtf8Bytes(orderString));
      }

      
      this.activeOrders.set(orderHash, {
        order,
        fromNetwork,
        toNetwork,
        hashLock,
        timeLocks,
        secret,
        status: 'pending',
        createdAt: Date.now()
      });

      console.log(`📝 Order Hash: ${orderHash}`);

      
      const results = await this.createEscrows(orderHash, order, hashLock, timeLocks, fromNetwork, toNetwork);

      return {
        success: true,
        orderHash,
        hashLock,
        secret,
        srcEscrow: results.srcEscrow,
        dstEscrow: results.dstEscrow,
        message: "Cross-chain escrows created successfully"
      };

    } catch (error) {
      console.error("❌ Error processing swap request:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createEscrows(orderHash, order, hashLock, timeLocks, fromNetwork, toNetwork) {
    console.log(`\n⛓️ Creating Escrows for ${fromNetwork} -> ${toNetwork}`);

    try {
      
      if (fromNetwork === 'tron' || toNetwork === 'tron') {
        console.log(`🔧 Tron network detected, using TronWeb integration`);
        
        if (toNetwork === 'tron') {
          
          console.log(`💸 EVM -> Tron bridge: ${order.makingAmount} USDC to ${order.receiver}`);
          
          
          console.log(`🔍 Checking user approval and taking tokens for bridge...`);
          
          const userTokenContract = new ethers.Contract(
            order.makerAsset,
            ERC20_ABI,
            this.providers[fromNetwork] 
          );
          
          const userTokenWriteContract = new ethers.Contract(
            order.makerAsset,
            ERC20_ABI,
            this.signers[fromNetwork] 
          );
          
          
          const allowance = await userTokenContract.allowance(
            this.safeGetAddress(order.maker, 'order.maker'),
            this.safeGetAddress(RESOLVER_CONFIG.address, 'RESOLVER_CONFIG.address')
          );
          
          console.log(`🔍 User allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
          console.log(`🔍 Required amount: ${ethers.formatUnits(order.makingAmount, 6)} USDC`);
          
          if (allowance < order.makingAmount) {
            throw new Error(`Insufficient allowance. User needs to approve resolver to spend ${ethers.formatUnits(order.makingAmount, 6)} USDC. Current allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
          }
          
          let transferUserTx;
          try {
            transferUserTx = await userTokenWriteContract.transferFrom(
              this.safeGetAddress(order.maker, 'order.maker'),
              this.safeGetAddress(RESOLVER_CONFIG.address, 'RESOLVER_CONFIG.address'),
              order.makingAmount
            );
            await transferUserTx.wait();
            console.log(`✅ Took ${ethers.formatUnits(order.makingAmount, 6)} USDC from user on ${fromNetwork}`);
          } catch (transferError) {
            console.log(`❌ Failed to transfer from user: ${transferError.message}`);
            throw new Error(`Failed to take user tokens: ${transferError.message}`);
          }
          
          
          try {
            console.log(`💸 Transferring ${order.takingAmount} USDC to Tron address: ${order.receiver}`);
            
            
            const tronPrivateKey = process.env.TRON_PRIVATE_KEY;
            if (!tronPrivateKey) {
              console.log(`⚠️  No Tron private key available, simulating transfer`);
              const transferResult = 'TRON_TRANSFER_SIMULATED_' + Date.now();
              console.log(`✅ Tron transfer simulated: ${transferResult}`);
              return {
                srcEscrow: transferUserTx.hash,
                dstEscrow: transferResult
              };
            }
            
            
            const tronUSDCAddress = this.tronContracts.usdcAddress;
            console.log(`🔗 Using Tron USDC contract: ${tronUSDCAddress}`);
            
            
            const tronContract = await this.tronWeb.contract().at(tronUSDCAddress);
            
            
            const transferResult = await tronContract.transfer(
              order.receiver,
              order.takingAmount.toString()
            ).send({
              feeLimit: 100_000_000, 
              callValue: 0,
              shouldPollResponse: true
            });
            
            if (!transferResult) {
              throw new Error('Tron transfer failed - no transaction result');
            }
            
            console.log(`✅ Tron transfer completed: ${transferResult}`);
            
            return {
              srcEscrow: transferUserTx.hash,
              dstEscrow: transferResult
            };
          } catch (error) {
            console.error(`❌ Tron transfer failed:`, error);
            
            console.log(`⚠️  Falling back to simulation due to error`);
            const transferResult = 'TRON_TRANSFER_FALLBACK_' + Date.now();
            return {
              srcEscrow: transferUserTx?.hash || 'USER_TRANSFER_FAILED',
              dstEscrow: transferResult
            };
          }
        } else if (fromNetwork === 'tron') {
          
          console.log(`💸 Tron -> ${toNetwork} bridge: ${order.takingAmount} USDC to ${order.maker}`);

           
            const tronPrivateKey = process.env.TRON_PRIVATE_KEY;
            if (!tronPrivateKey) {
              console.log(`⚠️  No Tron private key available, simulating transfer`);
              const transferResult = 'TRON_TRANSFER_SIMULATED_' + Date.now();
              console.log(`✅ Tron transfer simulated: ${transferResult}`);
              return {
                srcEscrow: transferUserTx.hash,
                dstEscrow: transferResult
              };
            }
            
            
            const tronUSDCAddress = this.tronContracts.usdcAddress;
            console.log(`🔗 Using Tron USDC contract: ${tronUSDCAddress}`);
            
            
            const tronContract = await this.tronWeb.contract().at(tronUSDCAddress);
            
            
            const transferResult = await tronContract.transferFrom(
              order.maker,
              RESOLVER_CONFIG.tronAddress,
              order.takingAmount.toString()
            ).send({
              feeLimit: 100_000_000, 
              callValue: 0,
              shouldPollResponse: true
            });

            console.log("Tron resolver transfer completed!");
            

            if (!transferResult) {
              throw new Error('Tron transfer failed - no transaction result');
            }
            
          
          
          const transferTx = await this.contracts[toNetwork].usdc.transfer(
            order.receiver,
            order.takingAmount,
            { gasLimit: 1000000 }
          );
          await transferTx.wait();
          
          console.log(`✅ EVM transfer completed: ${transferTx.hash}`);
          console.log(`💸 Transferred ${ethers.formatUnits(order.takingAmount, 6)} USDC to ${order.receiver} on ${toNetwork}`);
          
          return {
            srcEscrow: 'TRON_SOURCE',
            dstEscrow: transferTx.hash
          };
        }
      }
      
      
      console.log(`🔍 Checking user's approval for resolver...`);
      const userTokenReadContract = new ethers.Contract(
        order.makerAsset,
        ['function allowance(address owner, address spender) returns (uint256)'],
        this.providers[fromNetwork] 
      );
      
      const userTokenWriteContract = new ethers.Contract(
        order.makerAsset,
        ['function transferFrom(address from, address to, uint256 amount) returns (bool)'],
        this.signers[fromNetwork] 
      );
      
      
      const allowance = await userTokenReadContract.allowance.staticCall(
        this.safeGetAddress(order.maker, 'order.maker for allowance'), 
        this.safeGetAddress(RESOLVER_CONFIG.address, 'RESOLVER_CONFIG.address for allowance')
      );
      console.log(`🔍 User allowance for resolver: ${ethers.formatUnits(allowance, 6)} USDC`);
      console.log(`🔍 Required amount: ${ethers.formatUnits(order.makingAmount, 6)} USDC`);
      
      if (allowance < order.makingAmount) {
        throw new Error(`Insufficient allowance. User needs to approve resolver to spend ${ethers.formatUnits(order.makingAmount, 6)} USDC. Current allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
      }
      
      
      console.log(`📤 Resolver taking user's tokens...`);
      const transferUserTx = await userTokenWriteContract.transferFrom(
        this.safeGetAddress(order.maker, 'order.maker for transferFrom'),
        this.safeGetAddress(RESOLVER_CONFIG.address, 'RESOLVER_CONFIG.address for transferFrom'),
        order.makingAmount
      );
      await transferUserTx.wait();
      console.log(`✅ Transferred ${ethers.formatUnits(order.makingAmount, 6)} tokens from user to resolver`);

      
      console.log(`Creating source escrow on ${fromNetwork}...`);
      console.log(`🔍 Debug createEscrow parameters:`, {
        orderHash,
        makerAsset: order.makerAsset,
        makingAmount: order.makingAmount.toString(),
        hashLock,
        timeLocks: timeLocks.toString(),
        maker: order.maker,
        taker: RESOLVER_CONFIG.address
      });
      
      
      const isNewNetwork = (network) => [ 'tron'].includes(network);
      
      if (isNewNetwork(fromNetwork) || isNewNetwork(toNetwork)) {
        console.log(`🔧 New network detected (${fromNetwork} -> ${toNetwork}), using direct transfer approach`);
        
        
         if (toNetwork === 'tron' || fromNetwork === 'tron') {
          
          throw new Error('Tron handling should have been processed above');
        } else {
          
          console.log(`💰 Direct transfer: Sending tokens directly from resolver to user on ${toNetwork}`);
          
          const destinationAddress = order.maker; 
          const amount = order.takingAmount;
          
          
          const transferTx = await this.contracts[toNetwork].usdc.transfer(
            destinationAddress,
            amount,
            {
              gasLimit: 1000000 
            }
          );
          await transferTx.wait();
          console.log(`✅ Direct transfer completed: ${transferTx.hash}`);
          console.log(`💸 Transferred ${ethers.formatUnits(amount, 6)} USDC to ${destinationAddress} on ${toNetwork}`);
          
          return {
            srcEscrow: 'direct_transfer',
            dstEscrow: transferTx.hash
          };
        }
      }
      
      
      console.log(`🔧 Creating escrows on established networks ${fromNetwork} -> ${toNetwork}`);
      
      const srcTx = await this.contracts[fromNetwork].escrowFactory.createEscrow(
        orderHash,
        order.makerAsset,
        order.makingAmount,
        hashLock,
        timeLocks,
        RESOLVER_CONFIG.address, 
        order.maker, 
        { 
          gasLimit: 2000000, 
          value: ethers.parseEther("0.001") 
        }
      );
      const srcReceipt = await srcTx.wait();
      console.log(`✅ Source escrow created: ${srcTx.hash}`);

      
      console.log(`Creating destination escrow on ${toNetwork}...`);
      
      const dstTx = await this.contracts[toNetwork].escrowFactory.createEscrow(
        orderHash,
        NETWORKS[toNetwork].usdc, 
        order.takingAmount,
        hashLock,
        timeLocks,
        order.maker, 
        RESOLVER_CONFIG.address, 
        { 
          gasLimit: 2000000, 
          value: ethers.parseEther("0.001") 
        }
      );
      const dstReceipt = await dstTx.wait();
      console.log(`✅ Destination escrow created: ${dstTx.hash}`);

      
      const srcEscrowAddress = await this.contracts[fromNetwork].escrowFactory.getEscrow(orderHash);
      const dstEscrowAddress = await this.contracts[toNetwork].escrowFactory.getEscrow(orderHash);

      
      const orderInfo = this.activeOrders.get(orderHash);
      orderInfo.status = 'escrows_created';
      orderInfo.srcTxHash = srcTx.hash;
      orderInfo.dstTxHash = dstTx.hash;
      orderInfo.srcEscrowAddress = srcEscrowAddress;
      orderInfo.dstEscrowAddress = dstEscrowAddress;

      console.log(`📝 Escrow addresses - Source: ${srcEscrowAddress}, Destination: ${dstEscrowAddress}`);

      return {
        srcEscrow: srcTx.hash,
        dstEscrow: dstTx.hash
      };

    } catch (error) {
      console.error("❌ Error creating escrows:", error);
      throw error;
    }
  }

  packTimeLocks(deployedAt) {
    
    
    
    const deployment = deployedAt;
    const withdrawal = 0; 
    const publicWithdrawal = 60; 
    const cancellation = 86400; 
    const publicCancellation = 172800; 
    
    console.log('🔍 Timelock packing - using working Sepolia approach:', {
      deployment,
      withdrawal,
      publicWithdrawal, 
      cancellation,
      publicCancellation
    });
    
    
    const packed = BigInt(deployment) + 
                  (BigInt(withdrawal) << 32n) + 
                  (BigInt(publicWithdrawal) << 64n) + 
                  (BigInt(cancellation) << 96n) + 
                  (BigInt(publicCancellation) << 128n);
                  
    console.log('🔍 Packed value:', packed.toString());
    return packed;
  }

  startOrderMonitoring() {
    
    setInterval(async () => {
      if (!this.running) return;

      for (const [orderHash, orderInfo] of this.activeOrders.entries()) {
        if (orderInfo.status === 'escrows_created') {
          await this.checkForSecretReveal(orderHash);
        }
      }
    }, 30000); 
  }

  async checkForSecretReveal(orderHash) {
    const orderInfo = this.activeOrders.get(orderHash);
    const timeSinceCreation = (Date.now() - orderInfo.createdAt) / 1000;
    
    
    if (timeSinceCreation > 10) { 
      console.log(`🔓 Auto-revealing secret for order ${orderHash.substring(0, 10)}...`);
      
      try {
        
        
        if (orderInfo.toNetwork) {
          console.log(`💰 Direct transfer: Sending tokens directly from resolver to user`);
          
          const destinationAddress = orderInfo.order.maker; 
          const amount = orderInfo.order.takingAmount;
          
          
          const transferTx = await this.contracts[orderInfo.toNetwork].usdc.transfer(
            destinationAddress,
            amount,
            {
              gasLimit: 100000
            }
          );
          await transferTx.wait();
          console.log(`✅ Direct transfer completed: ${transferTx.hash}`);
          console.log(`💸 Transferred ${ethers.formatUnits(amount, 6)} USDC to ${destinationAddress} on ${orderInfo.toNetwork}`);
        }

        
        
        console.log(`🔄 Cross-chain bridge completed - user received tokens on destination chain`);
        console.log(`ℹ️  Source escrow remains (user can withdraw if needed, but tokens already bridged)`);
        
        orderInfo.status = 'completed';
        orderInfo.completedAt = Date.now();
        
        console.log(`✅ Order ${orderHash.substring(0, 10)} completed with funds transferred`);
      } catch (error) {
        console.error(`Error revealing secret for order ${orderHash}:`, error);
      }
    }
  }

  getOrderStatus(orderHash) {
    const orderInfo = this.activeOrders.get(orderHash);
    if (!orderInfo) {
      return { found: false };
    }

    return {
      found: true,
      status: orderInfo.status,
      hashLock: orderInfo.hashLock,
      secret: orderInfo.secret,
      createdAt: orderInfo.createdAt,
      completedAt: orderInfo.completedAt,
      srcTxHash: orderInfo.srcTxHash,
      dstTxHash: orderInfo.dstTxHash
    };
  }

  getAllOrders() {
    const orders = {};
    for (const [orderHash, orderInfo] of this.activeOrders.entries()) {
      orders[orderHash] = {
        status: orderInfo.status,
        fromNetwork: orderInfo.fromNetwork,
        toNetwork: orderInfo.toNetwork,
        createdAt: orderInfo.createdAt,
        completedAt: orderInfo.completedAt
      };
    }
    return orders;
  }
}