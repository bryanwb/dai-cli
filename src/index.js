// #!/usr/bin/env node

// This happens to be the Mnemonic used for the test network that runs the integration tests
// for dai.js
import chalk from 'chalk';

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
        provider: {type: 'TEST'}
      },
      provider: { type: 'TEST'},
      privateKey: config.privateKey,
    };
  } else {
    settings = {
      privateKey: config.privateKey,
      web3: {
        provider: {type: 'INFURA'},
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

const loadConfig = async (network) => {
  const ethers = require('ethers');
  const Maker = require('@makerdao/dai');
  
  const config = getCurrentConfig();

  const networkName = network ? network : config.network.name;
  
  let wallet;
  if (config.type === 'mnemonic') {
    wallet = ethers.Wallet.fromMnemonic(config.mnemonic);
  } else if (config.type === 'environment') {
    try {
      wallet = new ethers.Wallet(process.env[config.env_var_name]);
    } catch (err) {
      console.error(
        chalk.red(`Loading private key from environment variable ${config.env_var_name} failed because ${err.reason}`)
      );
      process.exit(1);
    }
  }
  const settings = await makeSettings(networkName, {privateKey: wallet.privateKey, infuraApiKey: config.infuraApiKey});
  const maker = await Maker.create(config.network.name, settings);
  await maker.authenticate();
  
  wallet.provider = settings.provider;
  if (settings.provider.type === 'TEST') {
    settings.provider.url = 'http://127.0.0.1:2000';
  }

  wallet.provider = new ethers.providers.JsonRpcProvider(settings.provider.url);

  return [config, wallet, maker];
};

async function startRepl(network) {
  const Repl = require('repl');
  const path = require('path');
  const fs = require('fs');
  const nodeReplHistory = path.join(process.env.HOME, '.node_repl_history');
  process.env['NODE_REPL_HISTORY'] = nodeReplHistory;
  const [config, wallet, maker] = await loadConfig(network);

  let repl_history_exists = fs.existsSync(nodeReplHistory) ? true : false;
  
  const r = Repl.start({prompt: 'dai> ', historySize: 1000, removeHistoryDuplicates: true});
  if (repl_history_exists) {
    fs.readFileSync(nodeReplHistory)
      .toString()
      .split('\n')
      .reverse()
      .filter(line => line.trim())
      .map(line => r.history.push(line));
  }

  r.context.maker = maker;
  r.context.wallet = wallet;
  r.context.eth = wallet.provider;
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

async function addConfig() {
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
  case 'encrypted json':
    throw new Error('Encrypted JSON not yet supported');
  default:
    throw new Error(`Unexpected type ${typeAnswer.type}`);
  }

  accounts[nameAnswer.name] = settings;
  updateDefaultAccount(nameAnswer.name, accounts);
  conf.set('accounts', accounts);
  console.log('Configuration ' + chalk.blue(nameAnswer.name) + ` stored at path ${conf.path} and is now the default`);

  let infuraApiKey = conf.get('infuraApiKey');
  let askForInfura = true;
  if (infuraApiKey) {
    const updateInfura = await inquirer.prompt([{type: 'confirm', name: 'prompt_infura', message: `You already have the Infura API Key set to '${infuraApiKey}' do you wish to change it?`}]);
    console.dir(updateInfura);
    if (!updateInfura.prompt_infura) {
      askForInfura = false;
    }
  }

  if (askForInfura) {
    const infuraQuestion = [{type: 'input', name: 'infura_api_key',
                             message: 'Enter your Infura API key. WARNING: This value is stored on disk.'}];
    const infuraAnswer = await inquirer.prompt(infuraQuestion);
    if (infuraAnswer.infura_api_key.trim() === '') {
      console.log(chalk.yellow(''));
    }
    conf.set('infuraApiKey', infuraAnswer.infura_api_key)
  }

  let network = conf.get('network') || {name: 'test', url: TEST_NETWORK_URL};
  
  const askNetworkQuestion = [{type: 'confirm', name: 'confirm',
                               message: `Do you wish to set the default network? Currently ${network.name} : ${network.url}`}];
  const askNetworkAnswer = await inquirer.prompt(askNetworkQuestion);
  if (askNetworkAnswer.confirm) {
    const networkAnswers = await inquirer.prompt([
      {type: 'input', name: 'name', message: 'Enter a name for the network'},
      {type: 'list', name: 'type', message: 'Enter a type for the network', choices: ['infura', 'http']},
      {type: 'input', name: 'url', message: 'Enter the JSON RPC URL for the network',
       when: (answers) => { answers.type === 'http'}},
    ]);
    
    network.name = networkAnswers.name;
    network.type = networkAnswers.type;
    if (networkAnswers.type === 'infura') {
      network.url = `https://${network.name}.infura.io/${conf.get('infuraApiKey')}`;
    } else {
      network.url = networkAnswers.url;
    }
  }
  conf.set('network', network);
}

const listConfig = () => {
  const conf = getConfig();
  if (conf.size === 0) {
    console.log(chalk.red('No configurations currently exist. Please run `dai config add`'));
    process.exit(1);
  }

  const network = conf.get('network') || {name: 'test', url: TEST_NETWORK_URL};
  console.log(`Default network: ${network.name} - ${network.url}`);
  const infuraApiKey = conf.get('infuraApiKey') || '(not set)';
  console.log(`Infura API Key: ${infuraApiKey}`);

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

const checkNodeVersion = () => {
  const nodeVersion = process.versions.node;
  const [major, minor, _] = nodeVersion.split('.');
  if (parseInt(major) < 10 || (parseInt(major) < 11 && parseInt(minor) < 15)) {
    console.error(chalk.yellow(`It appears you are running a version of node < 10.15.0. It is highly recommended that you use 10.15 or newer so that you can use the 'await' keyword in the REPL for asynchronous calls.`));
  }
};

const argv = require('yargs')
      .version()
      .usage('Usage: dai <command> [options]')
      .option('chain', {alias: 'C',
                    default: 'test',
                    describe: 'select a network',
                    choices: ['test', 'kovan', 'mainnet']})
      .command('repl', 'Start an READ-EVAL-PRINT-LOOP')
      .command('config', 'Manage configurations', (yargs) => {
        return yargs.command('add', 'add a configuration')
          .command('list', 'list available configurations')
          .command('switch [name]', 'switch current configuration')
          .demandCommand(1, 'You need at least one command before moving on');
      })
      .demandCommand(1, 'You need at least one command before moving on')
      .help('h')
      .alias('h', 'help')
      .epilogue('for more information, find the documentation at https://makerdao.com/documentation')
      .argv;

const subcommand = argv._[0];

switch (subcommand) {
case 'repl':
  checkNodeVersion();
  startRepl(argv.chain);
  break;
case 'config':
  const configCommand = argv._[1];
  switch (configCommand) {
  case 'add':
    addConfig();
    break;
  case 'list':
    listConfig();
    break;
  case 'switch':
    switchAccount(argv.name);
    break;
  default:
    throw new Error(`Unknown subcommand ${configCommand}`);
  }
  break;
default:
  throw new Error(`Unknown subcommand ${subcommand}`);
}
  
