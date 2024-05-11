# CLI: OP Stack Bridge with Withdrawal (ERC20 (L1) <-> Native (L2))
cli-op-stack-Bridge-erc20-to-native
cli-withdrawal

❗ **DISCLAIMER**: This content is provided for informational and educational purposes only. The content of this tutorial is not intended to be bait or duplicate. The information presented is for educational and entertainment purposes only. We are not responsible for any losses incurred or problems encountered online or elsewhere after reading and considering this tutorial content. If you are playing online using the information from this tutorial. You are doing so entirely and at your own risk.

**Deposit this**: https://deposit-op-stack-bridge-testing-erc20.netlify.app

## 1. Installation
Clone this repo

```
# Install [node](https://nodejs.org/en) v.18.18+
npm install (only!)
```

## 2. Setting
Warning: Be careful not to display your secrets.json. (mnemonic)

```
{
    "mnemonic": "my 12 words"
}
```

## 3. How to run
command terminal

**3.1** - withdraw
```
npx hardhat withdraw --amount 1
```
*Note: 1 = amount you want to withdraw* 

**3.2** - prove (It may take a time)
```
npx hardhat proveWithdrawal --tx {your transaction hash from: withdraw L2}
```

**3.3** - finalize (5-15 minutes for Testnet)
```
npx hardhat finalizeWithdrawal --tx {your transaction hash from: withdraw L2}
```

**3.4** - Withdrawal list
```
npx hardhat fetchWithdrawals
```

###
