import logger from '../utils/logger.js';

export class RewardService {
  constructor(config) {
    this.config = config;
  }

  generateRandomReward() {
    return this.randomizer(this.config.minReward, this.config.maxReward, true);
  }

  getRandomWinnerCount() {
    return this.randomizer(this.config.minWinners, this.config.maxWinners, true);
  }

  getRewardTypeEnd(reward) {
    const rules = [
      { 
        condition: (r) => r === 11 || 12 || 13 || 14, 
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

  calculateRewardPerWinner(totalReward, winnerCount) {
    return Math.floor(totalReward / winnerCount);
  }

  randomizer(min, max, isFloored = false) {
    return isFloored 
      ? Math.floor(min + Math.random() * (max - min + 1))
      : min + Math.random() * (max - min + 1);
  }

  validateReward(reward) {
    if (reward < this.config.minReward || reward > this.config.maxReward) {
      logger.warn('Reward outside valid range', { 
        reward, 
        min: this.config.minReward, 
        max: this.config.maxReward 
      });
      return false;
    }
    return true;
  }

  validateWinnerCount(winnerCount) {
    if (winnerCount < this.config.minWinners || winnerCount > this.config.maxWinners) {
      logger.warn('Winner count outside valid range', { 
        winnerCount, 
        min: this.config.minWinners, 
        max: this.config.maxWinners 
      });
      return false;
    }
    return true;
  }
}
