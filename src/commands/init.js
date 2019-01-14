const {Command, flags} = require('@oclif/command');
const {initConfig} = require('../app');

class Init extends Command {
  async run() {
    const {flags} = this.parse(Init);
    await initConfig();
  }
}

Init.description = 'Initialize your configuration';

Init.examples = [
  `$ dai init
Welcome to dai-shell! Your gateway to exploring DAI and MakerDAO
  `,
];

Init.flags = {
  // flag with no value (-f, --force)
  force: flags.boolean({char: 'f'}),
};

module.exports = Init;
