dai-shell
==================

An interactive shell and command-line interface for dai.js

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/dai-shell.svg)](https://npmjs.org/package/@bryanwb/dai-shell)
[![Downloads/week](https://img.shields.io/npm/dw/dai-shell.svg)](https://npmjs.org/package/@bryanwb/dai-shell)
[![License](https://img.shields.io/npm/l/dai-shell.svg)](https://github.com/git@github.com:bryanwb/dai-shell.git/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Getting Started](#getting-started)
* [Up and Running](#up-and-running)
* [Author & License](#author-license)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g dai-shell
$ dai COMMAND
running command...
$ dai (-v|--version|version)
dai-shell/0.0.6 linux-x64 node-v10.15.0
$ dai --help [COMMAND]
USAGE
  $ dai COMMAND
...
```
<!-- usagestop -->

# Getting Started


Next, you will want to configure dai-shell with an account. Run the `dai init` command and
a helpful wizard will walk you through adding your credentials. Note that dai-cli has the
option to store the name of an environment variable to source your private key from. When you tell
dai-cli to use an environment variable it only saves the name of that variable to disk and not your actual private key.
`dai init` will also ask you for you infura API key. This value is written to disk.

Subsequent configuration changes can be made with the `dai config` subcommand. Of special interest is the ability to add multiple accounts with the `dai config add` subcommand and switch the default account with the `dai config switch [accountName]` subcommand.


# Up and Running

Run `dai shell` to start a shell connected to a chain. Note that this is a customized node.js REPL w/ special pre-populated variables and support for the `await` keyword. All pre-populated variables are accessible from the `ctx` variable:

* maker: instance of the [Maker object](https://makerdao.com/documentation/#maker) connected to the chain specified during `dai config add` and with the current private key or mnemonic.
* Maker: The big daddy Maker object
* wallet: instance of [wallet object](https://docs.ethers.io/ethers.js/html/api-wallet.html#wallet) created from the mnemonic/private key you specified and connected to a network
* eth: a [connection](https://docs.ethers.io/ethers.js/html/api-providers.html) to Ethereum blockchain.
* utils: utility functions from [ethers](https://docs.ethers.io/ethers.js/html/api-utils.html)

Here is an example REPL session:


```sh-session
$ dai repl
Connecting to kovan - https://kovan.infura.io/[REDACTED]
dai> var cdp = await ctx.maker.openCdp()
dai> var result = await cdp.lockEth(0.1, ctx.Maker.ETH)
dai> result.receipt.blockNumber
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
