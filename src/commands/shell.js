const {Command, flags} = require('@oclif/command');
const {startRepl} = require('../app');

class Shell extends Command {
  async run() {
    const {flags} = this.parse(Shell);
    startRepl(flags.chain);
  }
}

Shell.description = 'Open an interactive shell';

Shell.examples = [
  `$ dai shell
Welcome to dai-shell! Let's whip it up!
dai>`,
];

Shell.flags = {
  chain: flags.string({char: 'C', default: 'test', description: 'chain to connect to, may be an JSON-RPC URL'}),
};

module.exports = Shell;
