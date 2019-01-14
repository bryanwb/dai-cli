const {Command} = require('@oclif/command');
const {setInfura} = require('../../app');

class Infura extends Command {
  async run() {
    const {args} = this.parse(Infura);
    setInfura(args.ApiKey);
  }
}

Infura.description = 'Set the Infura API key to use';
Infura.examples = [
  `$ dai config:infura
 ... sets your ApiKey
  `,
];

Infura.args = [{name: 'ApiKey'}];

module.exports = Infura;
