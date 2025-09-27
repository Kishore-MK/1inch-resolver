import express from 'express';
import cors from 'cors';
import { FusionResolver } from './fusion-resolver.js';
import { RESOLVER_CONFIG } from './config.js';

const app = express();
const resolver = new FusionResolver();


app.use(cors());
app.use(express.json());


console.log("🚀 Starting 1inch Resolver...");
await resolver.start();




app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: '1inch Resolver',
    resolver: RESOLVER_CONFIG.address,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});


 

app.post('/swap', async (req, res) => {
  try {
    const {
      fromNetwork,
      toNetwork,
      fromToken,
      toToken,
      amount,
      userAddress,
      destinationAddress
    } = req.body;

    
    if (!fromNetwork || !toNetwork || !fromToken || !toToken || !amount || !userAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fromNetwork', 'toNetwork', 'fromToken', 'toToken', 'amount', 'userAddress']
      });
    }

    if (!['sepolia', 'tron'].includes(fromNetwork) || !['sepolia',  'tron'].includes(toNetwork)) {
      return res.status(400).json({
        error: 'Unsupported network',
        supported: ['sepolia',  'tron']
      });
    }

    if (fromNetwork === toNetwork) {
      return res.status(400).json({
        error: 'Source and destination networks must be different'
      });
    }

    console.log(`\n📨 Received swap request from ${req.ip}`);
    console.log(`   ${amount} ${fromToken} (${fromNetwork}) -> ${toToken} (${toNetwork})`);

    
    let result;
    try {
      console.log('🔍 About to call processSwapRequest with:', {
        fromNetwork,
        toNetwork,
        fromToken,
        toToken,
        amount,
        userAddress,
        destinationAddress: destinationAddress || userAddress
      });
      
      result = await resolver.processSwapRequest({
        fromNetwork,
        toNetwork,
        fromToken,
        toToken,
        amount,
        userAddress,
        destinationAddress: destinationAddress || userAddress
      });
      
      console.log('✅ processSwapRequest completed with result:', result);
    } catch (swapError) {
      console.error('❌ Error in processSwapRequest:', swapError);
      console.error('Stack:', swapError.stack);
      
      return res.status(500).json({
        success: false,
        error: swapError.message
      });
    }

    if (result && result.success) {
      res.json({
        success: true,
        orderHash: result.orderHash,
        hashLock: result.hashLock,
        secret: result.secret, 
        srcEscrow: result.srcEscrow,
        dstEscrow: result.dstEscrow,
        message: result.message,
        architecture: '1inch Fusion+',
        nextSteps: [
          '1. Escrows created on both chains',
          '2. Waiting for finality period',
          '3. Secret will be auto-revealed',
          '4. Atomic swap completed'
        ]
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('💥 Swap request error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.get('/order/:orderHash', (req, res) => {
  try {
    const { orderHash } = req.params;
    const status = resolver.getOrderStatus(orderHash);
    
    if (!status.found) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    
    const statusMap = {
      'pending': 'Order created, preparing escrows',
      'escrows_created': 'Escrows deployed, waiting for finality',
      'completed': 'Atomic swap completed successfully',
      'failed': 'Swap failed, funds can be recovered'
    };

    res.json({
      ...status,
      statusDescription: statusMap[status.status] || 'Unknown status',
      architecture: '1inch Fusion+ HTLC'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


app.get('/orders', (req, res) => {
  try {
    const orders = resolver.getAllOrders();
    res.json({
      orders,
      count: Object.keys(orders).length,
      resolver: RESOLVER_CONFIG.address,
      architecture: '1inch Fusion+'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


app.get('/supported', (req, res) => {
  res.json({
    networks: {
      sepolia: {
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        tokens: ['USDC']
      },  
      tron: {
        name: 'Tron Shasta',
        chainId: 2,
        tokens: ['USDC']
      }
    },
    pairs: [     
      { from: 'sepolia', to: 'tron', tokens: ['USDC'] },
      { from: 'tron', to: 'sepolia', tokens: ['USDC'] },  
    ], 
  });
});


app.get('/debug', (req, res) => {
  res.json({
    resolver: RESOLVER_CONFIG.address,
    activeOrders: Array.from(resolver.activeOrders.keys()),
    config: {
      timeLocks: RESOLVER_CONFIG.timeLocks,
      auction: RESOLVER_CONFIG.auction,
      networks: Object.keys(resolver.providers)
    }
  });
});


app.use((error, req, res, next) => {
  console.error('💥 Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    architecture: '1inch Fusion+ Mock Resolver'
  });
});


const PORT = RESOLVER_CONFIG.port;
app.listen(PORT, () => {  
  console.log(`Listening: ${RESOLVER_CONFIG.address}`); 
});


process.on('SIGINT', async () => {
  console.log('\nShutting down Resolver...');
  await resolver.stop();
  process.exit(0);
});