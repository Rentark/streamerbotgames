import logger from '../utils/logger.js';

export class ParticipantManager {
  constructor() {
    this.participants = new Set();
    this.participantCount = 0;
  }

  addParticipant(username) {
    if (!username) {
      logger.warn('Attempted to add participant with empty username');
      return false;
    }

    if (!this.participants.has(username)) {
      this.participants.add(username);
      this.participantCount++;
      logger.info(`Participant added: ${username} (Total: ${this.participantCount})`);
      return true;
    } else {
      logger.info(`Participant already exists: ${username}`);
      return false;
    }
  }

  removeParticipant(username) {
    if (this.participants.has(username)) {
      this.participants.delete(username);
      this.participantCount--;
      logger.info(`Participant removed: ${username} (Total: ${this.participantCount})`);
      return true;
    }
    return false;
  }

  getParticipantCount() {
    return this.participantCount;
  }

  getParticipants() {
    return Array.from(this.participants);
  }

  hasParticipant(username) {
    return this.participants.has(username);
  }

  clearParticipants() {
    this.participants.clear();
    this.participantCount = 0;
    logger.info('All participants cleared');
  }

  getWinners(winnerCount) {
    if (this.participantCount === 0) {
      logger.warn('No participants available for winner selection');
      return [];
    }

    if (winnerCount > this.participantCount) {
      logger.warn(`Winner count (${winnerCount}) exceeds participant count (${this.participantCount})`);
      winnerCount = this.participantCount;
    }

    // Create an array of user indices [1, 2, ..., participantCount]
    let indices = Array.from({ length: this.participantCount }, (_, i) => i + 1);
    
    // Shuffle the array using Fisher-Yates algorithm
    this.shuffleArray(indices);
    
    // Return the first winnerCount indices (or just one if winnerCount === 1)
    return winnerCount === 1 ? [indices[0]] : indices.slice(0, winnerCount);
  }

  findUser(winnerId) {
    if (winnerId < 1 || winnerId > this.participantCount) {
      logger.error(`Invalid winner ID: ${winnerId}`);
      return null;
    }
    
    return Array.from(this.participants)[winnerId - 1];
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  getParticipantStats() {
    return {
      totalParticipants: this.participantCount,
      participants: this.getParticipants(),
      hasParticipants: this.participantCount > 0
    };
  }
}
