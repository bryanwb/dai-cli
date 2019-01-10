# Dai-cli helps you discover DeFi!

The `dai` provides commands and a REPL to help you learn how MakerDAO works and make
common operations easier.

# Getting started

Install the dai-cli npm package.

```
# to install globally w/ yarn
$ yarn global add @bryanwb/dai-cli
# or with npm
$ npm install -g @bryanwb/dai-cli
```

Next, you will want to configure dai-cli with an account. Run the `dai init` command and
a helpful wizard will walk you through adding your credentials. Note that dai-cli has the
option to store the name of an environment variable to source your private key from. When you tell
dai-cli to use an environment variable it only saves the name of that variable to disk and not your actual private key.
`dai init` will also ask you for you infura API key. This value is written to disk.

Subsequent configuration changes can be made with the `dai config` subcommand. Of special interest
is the ability to add multiple accounts with the `dai config add` subcommand and switch the default
account with the `dai config switch [accountName]` subcommand.

# Up and Running

Run `dai repl` to get a REPL connected to a chain. Note that this is a customized repl w/ special

pre-populated variables and support for the `await` keyword. All pre-populated variables are accessible from the `ctx` variable:

* maker: instance of the [Maker object](https://makerdao.com/documentation/#maker) connected to the chain specified during `dai config add` and with the current private key or mnemonic.
* Maker: The big daddy Maker object
* wallet: instance of [wallet object](https://docs.ethers.io/ethers.js/html/api-wallet.html#wallet) created from the mnemonic/private key you specified and connected to a network
* eth: a [connection](https://docs.ethers.io/ethers.js/html/api-providers.html) to Ethereum blockchain.
* utils: utility functions from [ethers](https://docs.ethers.io/ethers.js/html/api-utils.html)

Here is an example REPL session:

```shell
$ dai repl
Connecting to kovan - https://kovan.infura.io/[REDACTED]
dai> var cdp = await ctx.maker.openCdp()
dai> var result = await cdp.lockEth(0.1, ctx.Maker.ETH)
dai> result.receipt.blockNumber
10004760
dai> result.receipt.transactionHash
'0x49195e1dec124de3f3e98af40d499e33d14e73ddde5d56959ceb8981d7ae902a'
dai> cdp = await ctx.maker.getCdp(cdp.id)
dai> var v = await cdp.getCollateralValue()
dai> v.toString()
'0.10 ETH'
dai> result = await cdp.drawDai(5, ctx.Maker.DAI)
dai> var r = await cdp.getCollateralizationRatio()
dai> r
3.0606
```

# Author & License

Copyright 2019 Bryan W. Berry, MIT license
