import logger from './logger.js';

export class GameTimer {
  constructor() {
    this.timers = new Map();
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startTimer(name, duration, callback) {
    if (this.timers.has(name)) {
      logger.warn(`Timer '${name}' already exists, clearing previous timer`);
      this.clearTimer(name);
    }

    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        logger.error(`Error in timer callback for '${name}'`, { error });
      } finally {
        this.timers.delete(name);
      }
    }, duration);

    this.timers.set(name, timer);
    logger.info(`Timer '${name}' started for ${duration}ms`);
    
    return timer;
  }

  clearTimer(name) {
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
      logger.info(`Timer '${name}' cleared`);
      return true;
    }
    return false;
  }

  clearAllTimers() {
    this.timers.forEach((timer, name) => {
      clearTimeout(timer);
      logger.info(`Timer '${name}' cleared`);
    });
    this.timers.clear();
  }

  getRemainingTime(name) {
    // Note: This is a simplified implementation
    // For precise remaining time, you'd need to store start times
    return this.timers.has(name) ? 'active' : null;
  }

  isTimerActive(name) {
    return this.timers.has(name);
  }

  getActiveTimers() {
    return Array.from(this.timers.keys());
  }

  // Utility method for game countdown
  async countdown(duration, intervals, onInterval, onComplete) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    for (const interval of intervals) {
      await this.wait(interval);
      const remaining = Math.max(0, endTime - Date.now());
      
      if (onInterval) {
        onInterval(remaining);
      }
    }
    
    const finalWait = Math.max(0, endTime - Date.now());
    if (finalWait > 0) {
      await this.wait(finalWait);
    }
    
    if (onComplete) {
      onComplete();
    }
  }
}
