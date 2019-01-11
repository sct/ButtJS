import Discord from 'discord.js';

import logger from '../core/logger';
import {
  commandAbout,
  commandFirstRule,
  commandUnknown,
  commandHelp,
  commandButtifyCount
} from './commands/generalCommands';
import buttify from '../core/butt';
import {
  commandServerWhitelist,
  commandServerAccess,
  commandServerSetting
} from './commands/serverCommands';
import servers from '../core/handlers/Servers';
import wordsDb from '../core/handlers/Words';

const BOT_SYMBOL = '?';

class BotController {
  constructor() {
    this.client = new Discord.Client();
  }

  connect = () => {
    this.client.login(process.env.DISCORD_BOT_TOKEN);

    this.client.on('ready', () => {
      logger.info('Welcome to ButtBot (Discord Edition)');
      logger.info(
        "Remember! Isaac Buttimov's First Rule of Buttbotics: Don't let buttbot reply to buttbot."
      );
      logger.info('Connected to Discord');

      this.client.user.setPresence({
        game: { name: '?butt help | ?butt about' }
      });
    });
  };

  prepare = () => {
    this.loadListeners();
  };

  loadListeners = () => {
    this.client.on('message', message => {
      if (message.content.match(/^\?butt(.*)/)) {
        this.handleCommand(message);
      } else {
        this.handleButtChance(message);
      }
    });
  };

  handleCommand = message => {
    const command = message.content
      .replace(`${BOT_SYMBOL}butt `, '')
      .split(' ');

    logger.info(command);

    switch (command[0]) {
      case 'about':
        return commandAbout(message);
      case 'help':
        return commandHelp(message);
      case 'firstrule':
        return commandFirstRule(message);
      case 'stats':
        return commandButtifyCount(message);
      case 'whitelist':
        return commandServerWhitelist(message);
      case 'access':
        return commandServerAccess(message);
      case 'setting':
        return commandServerSetting(message, command[1], command[2]);
      default:
        return commandUnknown(message);
    }
  };

  async handleButtChance(message) {
    const server = await servers.getServer(message.guild.id);

    const whitelist = await server.getWhitelist();
    const config = await server.getSettings();

    // This is a small in-memory lock to prevent the bot from spamming back to back messages
    // on a single server due to strange luck.
    // Because the chance is calculated AFTER the lock is reset, there is only a roll for a
    // buttification chance every X number of messages
    if (server.lock > 0) {
      server.lock -= 1;
    }

    // Do the thing to handle the butt chance here
    if (
      (this.client.user.id !== message.author.id ||
        !message.author.bot ||
        config.breakTheFirstRuleOfButtbotics) &&
      whitelist.includes(message.channel.name) &&
      server.lock === 0 &&
      Math.random() < config.chanceToButt
    ) {
      buttify(message.content)
        .then(({ result, words }) => {
          message.channel.send(result).then(buttMessage => {
            if (config.buttAI === 1) {
              const emojiFilter = reaction =>
                reaction.emoji.name === '👍' || reaction.emoji.name === '👎';
              buttMessage.react('👍').then(() => buttMessage.react('👎'));
              buttMessage
                .awaitReactions(emojiFilter, { time: 1000 * 60 * 10 }) // Only listen for 10 minutes
                .then(async collected => {
                  const upbutts = collected.get('👍').count - 1;
                  const downbutts = collected.get('👎').count - 1;
                  const score = upbutts - downbutts;
                  words.forEach(async word => {
                    wordsDb.updateScore(word, score);
                  });
                })
                .catch(err => logger.error(err));
            }
          });
          server.lock = config.buttBuffer;
          server.trackButtification();
        })
        .catch(error => logger.debug(error));
    }
  }
}

export default BotController;