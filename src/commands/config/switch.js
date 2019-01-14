const {Command} = require('@oclif/command');
const {switchAccount} = require('../../app');

class SwitchCommand extends Command {
  async run() {
    const {args} = this.parse(SwitchCommand);
    await switchAccount(args.name);
  }
}

SwitchCommand.description = 'Switch default account';
SwitchCommand.args = [{name: 'name'}];
module.exports = SwitchCommand;
