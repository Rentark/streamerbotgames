import logger from '../logger.js';

export class DefaultMessageTemplate {
  constructor(config) {
    this.config = config;
  }

  prepareMessage(template, context) {
    
    const data = {
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
