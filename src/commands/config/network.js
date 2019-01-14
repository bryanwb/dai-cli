const {Command} = require('@oclif/command');
const {setNetwork} = require('../../app');

class Network extends Command {
  async run() {
    const {args} = this.parse(Network);
    setNetwork(args.network);
  }
}

Network.description = '';

Network.examples = [
  `$ dai config:network
... sets your default network
  `,
];

Network.args = [{name: 'network', default: 'test'}];

module.exports = Network;
