// #!/usr/bin/env node

// This happens to be the Mnemonic used for the test network that runs the integration tests
// for dai.js
import chalk from 'chalk';
import { pathToFileURL } from 'url';

// this is the url for the Ganache network that runs the dai.js integration tests
const TEST_NETWORK_URL = 'http://127.0.0.1:2000';

const makeSettings = async (network, config) => {
  let settings;
  const { setupEngine } = require('@makerdao/dai/src/eth/accounts/setup');

  if (network.toLowerCase() === 'test') {
    settings = {
      web3: {
        transactionSettings: { gasLimit: 4000000 },
        confirmedBlockCount: '0',
        provider: {type: 'TEST', url: 'http://127.0.0.1:2000'}
      },
      provider: { type: 'TEST'},
      privateKey: config.privateKey,
    };
  } else if (network.startsWith('http')) {
    settings = {
      privateKey: config.privateKey,
      web3: {
        provider: {type: 'HTTP', url: network},
        transactionSettings: {
          gasPrice: 15000000000,
          gasLimit: 4000000
        }
      }
    };
  } else {
    settings = {
      privateKey: config.privateKey,
      web3: {
        provider: {type: 'INFURA', url: `https://${network}.infura.io/${config.infuraApiKey || ''}`},
        transactionSettings: {
          gasPrice: 15000000000,
          gasLimit: 4000000
        }
      }
    };
  }

  await setupEngine(settings);

  return settings;
};

// this method wraps maker.authenticate w/ error handling
// see https://github.com/makerdao/dai.js/issues/75
const authenticate = async (authFunc) => {
  return new Promise((resolve, reject) => {
    authFunc().then(() => {
      resolve();
    });
    setTimeout(() => {
      reject(new Error('Failed to authenticate'));
    }, 10000);
  });
};

const loadConfig = async (network) => {
  const ethers = require('ethers');
  const Maker = require('@makerdao/dai');
  
  const config = getCurrentConfig();

  let wallet;
  switch (config.type) {
    case 'mnemonic':
      wallet = ethers.Wallet.fromMnemonic(config.mnemonic);
      break;
    case 'environment':
      try {
        wallet = new ethers.Wallet(process.env[config.env_var_name]);
      } catch (err) {
        console.error(
          chalk.red(`Loading private key from environment variable ${config.env_var_name} failed because ${err.reason}`)
        );
        process.exit(1);
      }
      break;
    case 'encrypted-json':
      wallet = await loadJsonWallet(config.address, config.password);
      break;
    default:
      throw new Error(`Account type ${config.type} not recognized`);
  }

  network = network ? network : config.network;
  
  const networkName = network.startsWith('http') ? 'http': network;

  const settings = await makeSettings(networkName, {privateKey: wallet.privateKey, infuraApiKey: config.infuraApiKey});
  settings.log = true;
  const maker = await Maker.create(networkName, settings);
  try {
    await authenticate(() => maker.authenticate(maker));
  } catch (err) {
    console.error(chalk.red(`Failed to authenticate to network ${networkName} with url ${settings.web3.provider.url}. Is it accessible?`));
    process.exit(1);
  }

  wallet.provider = settings.provider;
  wallet.provider = new ethers.providers.JsonRpcProvider(settings.web3.provider.url);

  return [config, wallet, maker];
};

async function loadJsonWallet(address, password) {
  const fs = require('fs');
  const path = require('path');
  const ethers = require('ethers');
  
  // strip any leading 0x
  address = address.startsWith('0x')? address.slice(2) : address;

  let walletJson;
  
  const keystoreDir = path.join(process.env.HOME, '.ethereum/keystore');
  const jsonWallets = fs.readdirSync(keystoreDir).filter((f) => f.endsWith(address)).map((f) => path.join(keystoreDir, f));
  if (jsonWallets.length > 1) {
    console.log(chalk.red(`ERROR: Found more than one keystore files matching address ${address}. That's not possible! Found files ${jsonWallets}`));
    process.exit(1);
  } else if (jsonWallets.length === 0) {
    console.log(chalk.red(`ERROR: Did not find keystore file matching address ${address} in directory ${keystoreDir}`));
    process.exit(1);
  } else {
    walletJson = fs.readFileSync(jsonWallets[0]).toString();
  }

  return ethers.Wallet.fromEncryptedWallet(walletJson, password);
}


async function startRepl(network) {
  const Repl = require('repl');
  const path = require('path');
  const fs = require('fs');
  const nodeReplHistory = path.join(process.env.HOME, '.node_repl_history');
  process.env['NODE_REPL_HISTORY'] = nodeReplHistory;

  const [config, wallet, maker] = await loadConfig(network);

  network = network ? network : config.network;

  let repl_history_exists = fs.existsSync(nodeReplHistory) ? true : false;

  console.log(chalk.yellow(`Connecting to ${network}`));
  
  const r = Repl.start({prompt: 'dai> ', historySize: 1000, removeHistoryDuplicates: true});
  if (repl_history_exists) {
    fs.readFileSync(nodeReplHistory)
      .toString()
      .split('\n')
      .reverse()
      .filter(line => line.trim())
      .map(line => r.history.push(line));
  }

  r.context.ctx = {};
  r.context.ctx.maker = maker;
  r.context.ctx.wallet = wallet;
  r.context.ctx.eth = wallet.provider;
  r.context.ctx.Maker = require('@makerdao/dai');
  r.context.ctx.utils = require('ethers/utils');
  r.on('exit', () => {
    fs.appendFileSync(nodeReplHistory, r.lines.join('\n'));
  });
}

function getConfig() {
  const Configstore = require('configstore');
  const conf = new Configstore('dai', {}, {globalConfigPath: true});
  return conf;
}

function getCurrentConfig() {
  const Configstore = require('configstore');
  const conf = new Configstore('dai', {}, {globalConfigPath: true});
  let currentConfig = {infuraApiKey: conf.get('infuraApiKey'), network: conf.get('network')};
  currentConfig = Object.assign(currentConfig, Object.values(conf.get('accounts')).filter((acct) => acct.default)[0]);
  return currentConfig;
}

const updateDefaultAccount = (name, accounts) => {
  for (let key of Object.keys(accounts)) {
    let account = accounts[key];
    account.default = name === key ? true : false;
    accounts[key] = account;
  }
};

async function addAccount() {
  const conf = getConfig();
  const accounts = conf.get('accounts') || {};
  const inquirer = require('inquirer');
  const nameQuestion = [{type: 'input', name: 'name',
                         default: 'test',
                         message: 'Enter a name for your configuration',
                         validate: function (input) { return input.toLowerCase() !== 'default' },
                        }];
  const nameAnswer = await inquirer.prompt(nameQuestion);

  const settings = {};
  
  const typeQuestion = [{type: 'list', name: 'type',
                         message: 'Enter how you wish to source your private key',
                         choices: ['environment variable', 'HD Wallet mnemonic', 'encrypted-json'], 
                        }];

  const typeAnswer = await inquirer.prompt(typeQuestion);

  switch (typeAnswer.type) {
  case 'environment variable':
      settings.type = 'environment';
      const envQuestion = [{type: 'input', name: 'env_var_name',
                            default: 'PRIVATE_KEY',
                            message: 'Enter the name of the environment variable you use to store your private key.\nOnly the name of the variable is stored on disk.\nThe value is only loaded into memory when the dai-cli command executes and is NEVER stored on disk.\n'
      }];
      const envAnswer = await inquirer.prompt(envQuestion);
      if (process.env[envAnswer.env_var_name] == '' || process.env[envAnswer.env_var_name] == undefined) {
        console.error(chalk.red(`No environment variable currently defined with the name ${envAnswer.env_var_name}, come back after you have set it`));
        process.exit(1);
      }
      settings.env_var_name = envAnswer.env_var_name;
      break;
  case 'HD Wallet mnemonic':
      settings.type = 'mnemonic';
      const mnemonicQuestion = [{type: 'input', name: 'mnemonic',
                                 message: 'Enter the mnemonic for your hierarchical deterministic wallet. WARNING: This value is stored on disk.'}];
      const mnemonicAnswer = await inquirer.prompt(mnemonicQuestion);
      settings.mnemonic = mnemonicAnswer.mnemonic;
      break;
  case 'encrypted-json':
      settings.type = 'encrypted-json';
      const addressQuestion = [{type: 'input', name: 'address',
                                 message: 'Enter the hexadecimal address for your encrypted JSON wallet.'}];
      const addressAnswer = await inquirer.prompt(addressQuestion);
      settings.address = addressAnswer.address;
      const passwordQuestion = [{type: 'password', name: 'password',
                                 message: 'Enter the password for your encrypted JSON wallet. WARNING: This value is stored on disk'}];
      const passwordAnswer = await inquirer.prompt(passwordQuestion);
      settings.password = passwordAnswer.password;
      await loadJsonWallet(settings.address, settings.password)
      break;
  default:
      throw new Error(`Unexpected type ${typeAnswer.type}`);
  }

  accounts[nameAnswer.name] = settings;
  updateDefaultAccount(nameAnswer.name, accounts);
  conf.set('accounts', accounts);
}

const setNetwork = async (networkName) => {
  const conf = getConfig();
  if (networkName == undefined) {
    
    const inquirer = require('inquirer');
    networkName = conf.get('network') || 'test';

    const askNetworkQuestion = [{type: 'confirm', name: 'confirm',
                                 message: `Do you wish to set the default network? Currently ${networkName}`}];
    const askNetworkAnswer = await inquirer.prompt(askNetworkQuestion);
    if (askNetworkAnswer.confirm) {
      const networkAnswers = await inquirer.prompt([{type: 'input', name: 'name', message: 'Enter a name or JSON RPC URL for the network'}]);
      networkName = networkAnswers.name;
    } else {
      return;
    }
  }
  conf.set('network', networkName);
  console.log(`Default network set to ${networkName}`);
};


const setInfura = async (infuraApiKey) => {
  const conf = getConfig();
  const inquirer = require('inquirer');
  
  if (infuraApiKey == undefined) {
    infuraApiKey = conf.get('infuraApiKey');
    let askForInfura = true;
    if (infuraApiKey) {
      const updateInfura = await inquirer.prompt([{type: 'confirm', name: 'prompt_infura', message: `You already have the Infura API Key set to '${infuraApiKey}' do you wish to change it?`}]);
      if (!updateInfura.prompt_infura) {
        askForInfura = false;
      }
    }

    if (askForInfura) {
      const infuraQuestion = [{type: 'input', name: 'infura_api_key',
                               message: 'Enter your Infura API key. WARNING: This value is stored on disk.'}];
      const infuraAnswer = await inquirer.prompt(infuraQuestion);
      infuraApiKey = infuraAnswer.infura_api_key;
    } else {
      return;
    }
  }
    
  conf.set('infuraApiKey', infuraApiKey)
  console.log('Infura API key updated');
};


const showConfig = () => {
  const conf = getConfig();
  if (conf.size === 0) {
    console.log(chalk.red('No configurations currently setup. Please run `dai init`'));
    process.exit(1);
  }

  const network = conf.get('network') || 'test';
  console.log(`Default network: ${network}`);
  const infuraApiKey = conf.get('infuraApiKey') || '(not set)';
  console.log(`Infura API Key: ${infuraApiKey.slice(0, 8)}...`);

  const accounts = conf.get('accounts') || [];
  if (accounts.length === 0) {
    console.log(chalk.red('No accounts currently configured'));
  } else {
    const Table = require('easy-table');
    const t = new Table();
    Object.entries(accounts).map(([name, acct]) => Object.assign({name: name}, acct))
      .map((acct) => {
        t.cell('name', acct.name);
        t.cell('default', acct.default ? 'true': '');
        t.cell('type', acct.type);
        t.cell('environment variable', acct.type === 'environment' ? acct.env_var_name : 'n/a');
        t.cell('mnemonmic', acct.type === 'mnemonic' ? `${acct.mnemonic.slice(0, 8)}...` : 'n/a');
        t.cell('encrypted json', acct.type === 'encrypted-json' ? `0x${acct.address.slice(0, 4)}.../${acct.password.slice(0,3)}...` : 'n/a');
        t.newRow();
      });
    console.log(t.toString());
  }
};

const switchAccount = async (name) => {
  const conf = getConfig();
  const accounts =  conf.get('accounts');

  if (name == undefined) {
    const inquirer = require('inquirer');
    const nameQuestion = [{type: 'list', name: 'name',
                           message: 'Select the account to be the default',
                           choices: Object.keys(accounts),
                          }];
    const nameAnswer = await inquirer.prompt(nameQuestion);
    name = nameAnswer.name;
  }

  if (!Object.keys(accounts).includes(name)) {
    console.log(chalk.red(`Cannot find existing account with name ${name}`));
    process.exit(1);
  }
  
  updateDefaultAccount(name, accounts);
  conf.set('accounts', accounts);

  
};

const initConfig = async () => {
  const splash = `
((((((((((((((((/((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
((((((((((((((*    /((((((((((((((((((((((((((((((((((((((((((*,***((((((((((((
((((((((((((((*      .(((((((((((((((((((((((((((((((((((((*,******((((((((((((
((((((((((((((*         ,(((((((((((((((((((((((((((((((/,*********((((((((((((
((((((((((((((*   /#(      *((((((((((((((((((((((((((******(#(****((((((((((((
((((((((((((((*   /((##*     .(((((((((((((((((((((******/##(((****((((((((((((
((((((((((((((*   /(((((#(      *((((((((((((((((******/#((((((****((((((((((((
((((((((((((((*   /((((((((#(.     /((((((((((******(#(((((((((****#(((((((((((
((((((((((((((*   /((((((((((##,     *((((((******##(((((((((((****#(((((((((((
(((((((((((((#*   /(((((((((((((##   .#((((/***(#((((((((((((((****#(((((((((((
(((((((((((((#*   /#(((((((((((((#   .#(((#/***((((((((((((((((****#(((((((((((
(((((((((((((#*   /#((((((((((((##   .#(((#/***(#((((((((((((((****#(((((((((((
#(########(###*   /#####(##(######   .#####/***(####(#####(####****##(#####(###
##############*   /###############   .#####/***(###############****############
##############*   /###############   .#####/***(###############****############
##############*   /###############   .#####/***(###############****############
##############/   (###############   ,#####(***(###############***/############
###############################################################################
`;

  
  console.log(chalk.green(splash));
  console.log(chalk.green('\tWelcome to dai-cli! Your gateway to exploring DAI and MakerDAO'));
  console.log(chalk.green('\tThis is a Hot Air production (https://hotair.tech)\n'));
  
  console.log("Let's get started. I have to ask a just few questions. It won't hurt, I promise.");
  
  await addAccount();
  await setNetwork();
  await setInfura();
  const configPath = getConfig().path;
  console.log(`Configuration now stored at path ${configPath}`);
  console.log(chalk.green(`You're all set! Rock with your bad self`));
}

const checkNodeVersion = () => {
  const nodeVersion = process.versions.node;
  const [major, minor, _] = nodeVersion.split('.');
  if (parseInt(major) < 10) {
    console.error(chalk.yellow(`It appears you are running a version of node < 10 It is highly recommended that you use node >= 10 so that you can use the 'await' keyword in the REPL for asynchronous calls.`));
  }
};


const yargs = require('yargs');
const argv = yargs.version()
                  .usage('Usage: dai <command> [options]')
                  .option('chain', {alias: 'C',
                                    default: getConfig().network ? getConfig().get('network') : 'test',
                                    describe: 'select a network, You can enter a name like `test`, `kovan`, `mainnet`, or a JSON RPC url such as `http://localhost:7545`. Note that `test` resolves to the special http://127.0.0.1:2000 JSON RPC URL used by the dai.js integration tests.'})
                  .command('repl', 'Start an READ-EVAL-PRINT-LOOP')
                  .command('init', 'initialize configuration')
                  .command('config', 'Manage configurations', (yargs) => {
                    return yargs
                      .command('add', 'add an account configuration')
                      .command('show', 'show current configuration')
                      .command('switch [name]', 'switch current configuration')
                      .command('network [networkName]', 'change the default network')
                      .command('infura [infuraApiKey]', 'set the infura api key')
                      .demandCommand(1, 'You need at least one command before moving on');
                  })
                  .demandCommand(1, 'You need at least one command before moving on')
                  .help('h')
                  .alias('h', 'help')
                  .epilogue('for more information, find the documentation at https://makerdao.com/documentation')
                  .argv;

const subcommand = argv._[0];

switch (subcommand) {
  case 'init':
    initConfig();
    break;
  case 'config':
    const configCommand = argv._[1];
    switch (configCommand) {
      case 'add':
        addAccount();
        break;
      case 'show':
        showConfig();
        break;
      case 'switch':
        switchAccount(argv.name);
        break;
      case 'network':
        setNetwork(argv.networkName);
        break;
      case 'infura':
        setInfura(argv.infuraApiKey);
        break;
      default:
        console.log(chalk.red(`Unknown subcommand ${configCommand}`));
        yargs.showHelp();
        break;
    }
    break;
  case 'repl':
    checkNodeVersion();
    startRepl(argv.chain);
    break;
  default:
    console.log(chalk.red(`Unknown subcommand ${configCommand}`));
    yargs.showHelp()
    break;
}
  
