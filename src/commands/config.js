const {Command, flags} = require('@oclif/command');
const {initConfig} = require('../app');

class Config extends Command {
  async run() {
    const {flags} = this.parse(Config);
    await initConfig();
  }
}

Config.description = 'Modify your configuration';

Config.examples = [
  `$ dai config
Welcome to dai-shell! Your gateway to exploring DAI and MakerDAO
  `,
];

Config.flags = {
  // flag with no value (-f, --force)
  force: flags.boolean({char: 'f'}),
};

module.exports = Config;
