const {Command} = require('@oclif/command');
const {addAccount} = require('../../app');

class AddCommand extends Command {
  async run() {
    await addAccount();
  }
}

AddCommand.description = 'Add an account';
module.exports = AddCommand;
