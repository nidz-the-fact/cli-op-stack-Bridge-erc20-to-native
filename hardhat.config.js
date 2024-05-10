/**
 * Profile: https://linktr.ee/nid_z
 * Team ThaiChain Foundation (https://www.thaichain.io/)
 * 
 * @title cli-op-stack-Bridge-erc20-to-native
 * @notice cli-withdrawal
 * @author nidz-the-fact
 */

const { keccak256 } = require('@ethersproject/keccak256');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { HashZero } = require('@ethersproject/constants');

const { mnemonic } = require('./secrets.json');
const l1BridgeAbi = require('./l1standardbridge.json');
const tokenAbi = require('./erc20.json');
const l2BridgeAbi = require('./l2standardbridge.json');
const l2Tol1MessagePasserAbi = require('./l2tol1messagepasser.json');
const l2OuputOracleAbi = require('./l2OutputOracle.json');
const optimismPortalAbi = require('./optimismPortal.json');

require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-ethers');

// edit
const l1StandardBridge = '0x3C91efB30c55FbD5782be4BbA3D9628C1074a18D';
const l2StandardBridge = '0x4200000000000000000000000000000000000010';
const l2ToL1MessagePasser = '0x4200000000000000000000000000000000000016';
const l2OutputOracle = '0x74Ad6E0FB793eB5e6c1ff1225B03F5C5fFB7EF0c';
const optimismPortal = '0x0d605bb7d4FB586eAB750205F5247825F4D8AF4B';

const defaultGasAmount = '1000000';
const emptyData = '0x';
const l2ExplorerApi = 'https://exp.hera.jbcha.in/api'; // L2

const getL1Wallet = () => {
  const provider = new ethers.JsonRpcProvider
    (hreConfig.networks['JibcahinTestnet'].url); // edit - L1
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  const signer = wallet.connect(provider);

  return signer;
};

const getL2Wallet = () => {
  const provider = new ethers.JsonRpcProvider(
    hreConfig.networks['HeraTestnet-JibcahinTestnet'].url,); // edit - L2-L1
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  const signer = wallet.connect(provider);

  return signer;
};


/** @type import('hardhat/config').HardhatUserConfig */
const hreConfig = {
  solidity: '0.8.17',
  defaultNetwork: 'JibcahinTestnet', // edit - main
  networks: {
    hardhat: {},
    // edit
    JibcahinTestnet: {
      url: 'https://rpc.testnet.jibchain.net', // L1
      accounts: {
        mnemonic,
      },
      gasPrice: 1000000,
    },
    // L2-L1
    'HeraTestnet-JibcahinTestnet': {
      url: 'https://rpc.hera.jbcha.in', // L2
      accounts: {
        mnemonic,
      },
      gasPrice: 1000000,
    },
  },
};
module.exports = hreConfig;



const getPortalContract = (signer) => {
  const portalContract = new ethers.Contract(
    optimismPortal,
    optimismPortalAbi,
    signer,
  );
  return portalContract;
};

const getOracleContract = (signer) => {
  const oracleContract = new ethers.Contract(
    l2OutputOracle,
    l2OuputOracleAbi,
    signer,
  );
  return oracleContract;
};

const getMessageContract = (signer) => {
  const messageContract = new ethers.Contract(
    l2ToL1MessagePasser,
    l2Tol1MessagePasserAbi,
    signer,
  );
  return messageContract;
};

const getL1StandardBridgeContract = (signer) => {
  const bridgeContract = new ethers.Contract(
    l1StandardBridge,
    l1BridgeAbi,
    signer,
  );
  return bridgeContract;
};

const getL2StandardBridgeContract = (signer) => {
  const bridgeContract = new ethers.Contract(
    l2StandardBridge,
    l2BridgeAbi,
    signer,
  );
  return bridgeContract;
};

const getTokenContract = (signer, address) => {
  const tokenContract = new ethers.Contract(address, tokenAbi, signer);
  return tokenContract;
};

const makeStateTrieProof = async (provider, blockNumber, address, slot) => {
  const proof = await provider.send('eth_getProof', [
    address,
    [slot],
    blockNumber,
  ]);

  return {
    accountProof: proof.accountProof,
    storageProof: proof.storageProof[0].proof,
    storageValue: BigInt(proof.storageProof[0].value),
    storageRoot: proof.storageHash,
  };
};

const hashWithdrawal = (withdrawalMessage) => {
  const types = [
    'uint256',
    'address',
    'address',
    'uint256',
    'uint256',
    'bytes',
  ];
  const encoded = defaultAbiCoder.encode(types, [
    withdrawalMessage.nonce,
    withdrawalMessage.sender,
    withdrawalMessage.target,
    withdrawalMessage.value,
    withdrawalMessage.gasLimit,
    withdrawalMessage.data,
  ]);
  return keccak256(encoded);
};

const getWithdrawalMessage = async (messageContract, withdrawal, isToken) => {
  let messageLog = withdrawal.logs.find((log) => {
    if (log.address === l2ToL1MessagePasser) {
      const parsed = messageContract.interface.parseLog(log);
      console.log('parsed', parsed);
      return parsed.name === 'MessagePassed';
    }
    return false;
  });
  console.log('messageLog', messageLog);

  if (!messageLog) {
    messageLog = withdrawal.logs[0];
  }
  const parsedLog = messageContract.interface.parseLog(messageLog);

  const withdrawalMessage = {
    nonce: parsedLog.args.nonce,
    sender: parsedLog.args.sender,
    target: parsedLog.args.target,
    value: parsedLog.args.value,
    gasLimit: parsedLog.args.gasLimit,
    data: parsedLog.args.data,
  };
  console.log('withdrawalMessage', withdrawalMessage);
  return withdrawalMessage;
};

const fetchTransactions = async (address) => {
  const params = {
    address,
    action: 'txlist',
    module: 'account',
    filterby: 'from',
    startblock: '0',
  };
  const searchParams = new URLSearchParams(params).toString();
  const url = new URL(l2ExplorerApi);
  url.search = searchParams;
  const transactions = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await transactions.json();
  return data;
};

task('balance', "Prints an account's balance").setAction(async (taskArgs) => {
  const signer = await ethers.provider.getSigner();
  const balance = await ethers.provider.getBalance(await signer.getAddress());

  console.log(ethers.formatEther(balance), 'ETH');
});


// task('bridge', 'Bridges ETH to HeraTestnet-JibcahinTestnet')
//   .addParam('amount', 'The amount to bridge')
//   .setAction(async (taskArgs) => {
//     const signer = await ethers.provider.getSigner();
//     const bridgeContract = getL1StandardBridgeContract(signer);

//     const sender = await bridgeContract.l2TokenBridge();
//     console.log('sender', sender);

//     const fmtAmount = ethers.parseUnits(taskArgs.amount);
//     console.log('fmtAmount', fmtAmount);

//     try {
//       const bridgeResult = await bridgeContract.bridgeETH(
//         defaultGasAmount,
//         emptyData,
//         {
//           value: fmtAmount,
//         },
//       );
//       console.log('bridgeResult', bridgeResult);
//       const transactionReceipt = await bridgeResult.wait();
//       console.log('transactionReceipt', transactionReceipt);
//     } catch (e) {
//       console.log('bridgeResult error', e);
//     }
//   });

// task('bridgeToken', 'Bridges erc20 token to HeraTestnet-JibcahinTestnet')
//   .addParam('amount', 'The amount to bridge')
//   .addParam('l1token', 'The token address on JibcahinTestnet')
//   .addParam('l2token', 'The token address on HeraTestnet-JibcahinTestnet')
//   .setAction(async (taskArgs) => {
//     const signer = await ethers.provider.getSigner();
//     const bridgeContract = getL1StandardBridgeContract(signer);

//     const sender = await bridgeContract.l2TokenBridge();
//     console.log('sender', sender);

//     const fmtAmount = ethers.parseUnits(taskArgs.amount);
//     console.log('fmtAmount', fmtAmount);

//     const tokenContract = getTokenContract(signer, taskArgs.l1token);

//     try {
//       const allowance = await tokenContract.allowance(
//         await signer.getAddress(),
//         l1StandardBridge,
//       );
//       if (allowance < fmtAmount) {
//         console.log('approve bridge to access token');
//         const approveResult = await tokenContract.approve(
//           l1StandardBridge,
//           fmtAmount,
//         );
//         console.log('approve result', approveResult);
//       } else {
//         console.log('token is approved to deposit');
//       }

//       const bridgeResult = await bridgeContract.depositERC20(
//         taskArgs.l1token,
//         taskArgs.l2token,
//         fmtAmount,
//         defaultGasAmount,
//         emptyData,
//       );
//       console.log('bridge token result', bridgeResult);
//       const transactionReceipt = await bridgeResult.wait();
//       console.log('token transaction receipt', transactionReceipt);
//     } catch (e) {
//       console.log('bridge token result error', e);
//     }
//   });

task(
  'withdraw',
  'Initiates a native token withdrawal from HeraTestnet-JibcahinTestnet to JibcahinTestnet',
)
  .addParam('amount', 'The amount to bridge')
  .setAction(async (taskArgs) => {
    const signer = await getL2Wallet();
    const messageContract = getMessageContract(signer);

    try {
      const nonce = await messageContract.messageNonce();
      console.log('Message nonce:', nonce);

      const fmtAmount = ethers.parseUnits(taskArgs.amount);
      console.log('Amount to bridge:', fmtAmount.toString());

      const bridgeResult = await messageContract.initiateWithdrawal(
        signer.address,
        defaultGasAmount,
        emptyData,
        { value: fmtAmount },
      );

      console.log('Withdrawal successful. Transaction hash:', bridgeResult.hash);
      console.log('Withdrawn amount:', taskArgs.amount);
    } catch (error) {
      console.error('Withdrawal failed. Error:', error.message);
    }
  });

task(
  'withdrawToken',
  'Initiates a native token withdrawal from HeraTestnet-JibcahinTestnet to JibcahinTestnet',
)
  .addParam('amount', 'The amount to bridge')
  .addParam('token', 'The token address on HeraTestnet-JibcahinTestnet')
  .setAction(async (taskArgs) => {
    const signer = await getL2Wallet();
    const l2StandardBridgeContract = getL2StandardBridgeContract(signer);

    const fmtAmount = ethers.parseUnits(taskArgs.amount);
    console.log('fmtAmount', fmtAmount);

    try {
      const bridgeResult = await l2StandardBridgeContract.withdraw(
        taskArgs.token,
        fmtAmount,
        defaultGasAmount,
        '0x01',
      );
      console.log('withdrawal result', bridgeResult);
      const transactionReceipt = await bridgeResult.wait();
      console.log('withdrawal transaction receipt', transactionReceipt);
    } catch (e) {
      console.log('withdrawal error', e);
    }
  });

task(
  'proveWithdrawal',
  'Proves a native token withdrawal from HeraTestnet-JibcahinTestnet to JibcahinTestnet',
)
  .addParam('tx', 'The transaction hash of the withdrawal')
  .setAction(async (taskArgs) => {
    const signer = await getL2Wallet();
    const l1Signer = await getL1Wallet();
    const oracleContract = getOracleContract(l1Signer);
    const messageContract = getMessageContract(signer);
    const portalContract = getPortalContract(l1Signer);

    const withdrawal = await signer.provider.getTransactionReceipt(taskArgs.tx);
    console.log('withdrawal receipt', withdrawal.blockNumber, withdrawal);

    const l2OutputIdx = await oracleContract.getL2OutputIndexAfter(
      withdrawal.blockNumber,
    );
    console.log('l2OutputIdx', l2OutputIdx);

    const l2Output = await oracleContract.getL2Output(l2OutputIdx);
    console.log('l2Output', l2Output);

    const withdrawalMessage = await getWithdrawalMessage(
      messageContract,
      withdrawal,
    );

    const hashedWithdrawal = hashWithdrawal(withdrawalMessage);

    const messageSlot = keccak256(
      defaultAbiCoder.encode(
        ['bytes32', 'uint256'],
        [hashedWithdrawal, HashZero],
      ),
    );

    const l2BlockNumber = '0x' + BigInt(l2Output[2]).toString(16);

    const proof = await makeStateTrieProof(
      signer.provider,
      l2BlockNumber,
      l2ToL1MessagePasser,
      messageSlot,
    );
    console.log('proof', proof);

    const block = await signer.provider.send('eth_getBlockByNumber', [
      l2BlockNumber,
      false,
    ]);
    console.log('block', block);

    const outputProof = {
      version: HashZero,
      stateRoot: block.stateRoot,
      messagePasserStorageRoot: proof.storageRoot,
      latestBlockhash: block.hash,
    };
    console.log('outputProof', outputProof);

    try {
      const proving = await portalContract.proveWithdrawalTransaction(
        withdrawalMessage,
        l2OutputIdx,
        outputProof,
        proof.storageProof,
      );
      console.log('proving', proving);
      console.log('Waiting for proveWithdrawal...');
      const result = await proving.wait();
      console.log('proving result', result);
      console.log('proveWithdrawal successful.');
    } catch (e) {
      console.log('withdrawal error', e);
      console.log('proveWithdrawal successful.');
    }
  });

task(
  'finalizeWithdrawal',
  'Finalizes a native token withdrawal from HeraTestnet-JibcahinTestnet to JibcahinTestnet',
)
  .addParam('tx', 'The transaction hash of the withdrawal')
  .setAction(async (taskArgs) => {
    const signer = await getL2Wallet();
    const l1Signer = await getL1Wallet();

    const portalContract = getPortalContract(l1Signer);
    const messageContract = getMessageContract(signer);

    const withdrawal = await signer.provider.getTransactionReceipt(taskArgs.tx);
    console.log('withdrawal receipt', withdrawal.blockNumber, withdrawal);

    const msg = await getWithdrawalMessage(messageContract, withdrawal);
    console.log('msg', msg);
    try {
      const finalizing =
        await portalContract.finalizeWithdrawalTransaction(msg);
      console.log('finalizing', finalizing);
      const result = await finalizing.wait();
      console.log('finalizing result', result);
      console.log(`Withdrawal successful.`);
      console.log(`View transaction: https://exp.testnet.jibchain.net/`);
    } catch (e) {
      console.log('finalize error', e);
    }
  });

task('fetchWithdrawals', 'Fetchs all withdrawals')
  .addFlag('full', 'Show the full address')
  .setAction(async (taskArgs) => {
    const signer = await getL2Wallet();
    const l1Signer = await getL1Wallet();
    const portalContract = getPortalContract(l1Signer);
    const messageContract = getMessageContract(signer);
    const oracleContract = getOracleContract(l1Signer);
    const l2StandardBridgeContract = getL2StandardBridgeContract(signer);

    try {
      const data = await fetchTransactions(await signer.getAddress());
      const withdrawals = [];
      for (let i = 0; i < data.result.length; i++) {
        const tx = data.result[i];
        console.log(i, tx);
        if (tx.isError === '1') continue;
        if (tx.to === l2ToL1MessagePasser && tx.value !== '0')
          withdrawals.push(tx);
        if (tx.to === optimismPortal && tx.value !== '0') withdrawals.push(tx);
        if (tx.to === l2StandardBridge) {
          const functionName = l2StandardBridgeContract.interface.getFunction(
            tx.input.slice(0, 10),
          ).name;
          console.log('functionName', functionName);
          if (functionName === 'withdraw') {
            const decodedWithdrawData =
              l2StandardBridgeContract.interface.decodeFunctionData(
                tx.input.slice(0, 10),
                tx.input,
              );
            tx.value = decodedWithdrawData[1].toString();

            const tokenDetails = getTokenContract(
              signer,
              decodedWithdrawData[0],
            );
            tx.symbol = await tokenDetails.symbol();

            withdrawals.push(tx);
          }
        }
      }
      console.log('raw transactions', withdrawals);

      const latestBlockNumber = await oracleContract.latestBlockNumber();
      const finalizationPeriod =
        await oracleContract.FINALIZATION_PERIOD_SECONDS();
      for (let i = 0; i < withdrawals.length; i++) {
        const withdrawal = withdrawals[i];
        const receipt = await signer.provider.getTransactionReceipt(
          withdrawal.hash,
        );
        console.log('receipt', receipt);
        const wm = await getWithdrawalMessage(messageContract, receipt);
        const hash = hashWithdrawal(wm);
        const isFinalized = await portalContract.finalizedWithdrawals(hash);
        withdrawal.isFinalized = isFinalized;

        const rawProof = await portalContract.provenWithdrawals(hash);
        withdrawal.rawProof = rawProof;
        const isProven = rawProof[0] !== HashZero;
        withdrawal.isReadyToFinalize =
          Math.floor(Date.now() / 1000) > rawProof[1] + finalizationPeriod &&
          !isFinalized &&
          isProven;
        withdrawal.isProven = isProven;
        withdrawal.isReadyToProve =
          latestBlockNumber >= receipt.blockNumber && !isFinalized && !isProven;
      }

      console.log('withdrawals', withdrawals);
      const sorted = withdrawals.sort((a, b) => {
        return a.timeStamp > b.timeStamp;
      });
      const withdrawalTable = sorted.map((withdrawal) => ({
        hash: taskArgs.full
          ? withdrawal.hash
          : withdrawal.hash.substring(0, 6) +
          '...' +
          withdrawal.hash.substring(withdrawal.hash.length - 6),
        symbol: withdrawal.symbol || 'ETH',
        value: withdrawal.value,
        isReadyToProve: withdrawal.isReadyToProve,
        isProven: withdrawal.isProven,
        isReadyToFinalize: withdrawal.isReadyToFinalize,
        isFinalized: withdrawal.isFinalized,
      }));
      console.table(withdrawalTable);
    } catch (e) {
      console.log('fetch withdrawals error', e);
    }
  });
