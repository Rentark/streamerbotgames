import logger from '../logger.js';

export class StarfallMessageTemplate {
  constructor(config) {
    this.config = config;
  }

  prepareMessage(template, context, me = true) {
    let rewardTypeEnd = '';
    if (me) rewardTypeEnd = this.getRewardTypeEnd(context.reward);
    
    const data = {
      rewardType: this.config.rewardTypes.partialName + rewardTypeEnd,
      rewardTypeFull: this.config.rewardTypes.name,
      rewardAmount: context.reward,
      gameName: this.config.gameName[context.winnerCount === 1 ? "single" : "multi"],
      gameLength: context.currentGameLength ? context.currentGameLength / 1000 : 0,
      ...context
    };
    logger.info("data", {data})
    
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined) {
        logger.warn(`Template variable '${key}' not found in context`);
        return match;
      }
      return value;
    });
  }

  formatWinners(winners, reward) {
    if (!winners || winners.length === 0) {
      logger.warn('No winners provided for formatting');
      return '';
    }

    const winnerCount = winners.length;
    const rewardPerWinner = Math.floor(reward / winnerCount);
    
    const template = this.config.winnerMessage;
    
    const context = {
      winner: winnerCount === 1 ? `@${winners[0]}` : `@${winners.join(', @')}`,
      winners: `@${winners.join(', @')}`,
      winnerCount: winnerCount,
      reward: rewardPerWinner,
      winWords: winnerCount === 1 ? this.config.singleWinWord : this.config.multiWinWord,
    };
    
    return this.prepareMessage(template, context);
  }

  getRewardTypeEnd(reward) {
    const rules = [
      { 
        condition: (r) => (r == 11 || r == 12 || r == 13 || r == 14), 
        suffix: this.config.rewardTypes["0"] 
      },
      { 
        condition: (r) => r % 10 === 0, 
        suffix: this.config.rewardTypes["0"] 
      },
      { 
        condition: (r) => r % 10 === 0, 
        suffix: this.config.rewardTypes["0"] 
      },
      { 
        condition: (r) => r % 10 === 1, 
        suffix: this.config.rewardTypes["1"] 
      },
      { 
        condition: (r) => [2, 3].includes(r % 10), 
        suffix: this.config.rewardTypes["2-3"] 
      }
    ];
    
    const rule = rules.find(r => r.condition(Number(reward.toString().slice(-2)))) || { 
      suffix: this.config.rewardTypes["0"] 
    };
    
    return rule.suffix;
  }

  validateTemplate(template) {
    const requiredVariables = this.extractVariables(template);
    const missingVariables = requiredVariables.filter(variable => 
      !this.config.rewardTypes[variable] && 
      !this.config.gameName[variable] &&
      variable !== 'rewardAmount' &&
      variable !== 'winnerCount' &&
      variable !== 'gameLength' &&
      variable !== 'winner' &&
      variable !== 'winners'
    );

    if (missingVariables.length > 0) {
      logger.warn('Template contains undefined variables', { missingVariables });
      return false;
    }

    return true;
  }

  extractVariables(template) {
    const variables = [];
    const regex = /\{(\w+)\}/g;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }

  formatGameStartMessage(reward, winnerCount, currentGameLength) {
    return this.prepareMessage(this.config.gameStartMessage, {
      reward,
      winnerCount,
      currentGameLength
    });
  }

  formatGameEndNotification(msg, reward, currentGameLength, winnerCount) {
    let getSecondsTypeEnd = (currentGameLength) => {
      const rules = [
        { 
          condition: (r) => r % 10 === 0, 
          suffix: this.config.secondsTypes["0"] 
        },
        { 
          condition: (r) => [2, 3, 4].includes(r % 10), 
          suffix: this.config.secondsTypes["2-4"] 
        }
      ];
      
      const rule = rules.find(r => r.condition(currentGameLength / 1000)) || { 
        suffix: this.config.secondsTypes["0"] 
      };
      
      return rule.suffix;
    }

    return this.prepareMessage(
      msg, 
        { 
          reward: reward, 
          currentGameLength: currentGameLength,
          winnerCount: winnerCount,
          seconds: this.config.secondsTypes.partialName + getSecondsTypeEnd(currentGameLength)
        }
    );
  }
  
}
