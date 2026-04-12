import logger from '../logger.js';

export class KnockMessageTemplate {
  constructor(config) {
    this.config = config;
  }

  prepareMessage(template, context) {
    
    
    const data = {
      rewardAmount: context.reward,
      ...context
    };
    
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined) {
        logger.warn(`Template variable '${key}' not found in context`);
        return match;
      }
      return value;
    });
  }

  formatKnockSelf({sender, reward, count}) {
    if (!sender) {
      logger.warn('No user provided for formatting');
      return '';
    }
    
    const template = this.config.messages.knockSelf;
    const rewardTypeEnd = this.getRewardTypeEnd(reward);
    
    const context = {
      sender: sender,
      rewardType: this.config.rewardTypes.partialName + rewardTypeEnd,
      randomWords: this.config.messages.randomWordsSelf[Math.floor(Math.random() * this.config.messages.randomWordsSelf.length)],
      reward: reward,
      count: count
    };
    
    return this.prepareMessage(template, context);
  }

  formatKnockOther({sender, target, reward, count}) {
    if (!sender) {
      logger.warn('No user provided for formatting');
      return '';
    }
    
    const template = this.config.messages.knockOthers;
    const rewardTypeEnd = this.getRewardTypeEnd(reward);

    const context = {
      sender: sender,
      target: target,
      rewardType: this.config.rewardTypes.partialName + rewardTypeEnd,
      randomWords: this.config.messages.randomWordsOther[Math.floor(Math.random() * this.config.messages.randomWordsOther.length)],
      reward: reward,
      count: count
    };
    
    return this.prepareMessage(template, context);
  }

  getRewardTypeEnd(reward) {
    const rules = [
      { 
        condition: (r) => (r === 11 || r === 12 || r === 13 || r === 14), 
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
  
}
