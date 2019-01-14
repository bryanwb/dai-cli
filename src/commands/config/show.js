const {Command} = require('@oclif/command');
const {showConfig} = require('../../app');

class Show extends Command {

  async run() {
    showConfig();
  }
}

Show.description = 'Show your current and available configurations';

Show.examples = [
  `$ dai config:show`,
];

module.exports = Show;
