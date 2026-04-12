// Example test file for the refactored Loot Drop Game
// This demonstrates how the class-based architecture improves testability

import { MessageService } from '../services/MessageService.js';
import { RewardService } from '../services/RewardService.js';
import { ParticipantManager } from '../managers/ParticipantManager.js';
import { GameTimer } from '../utils/GameTimer.js';
import { MessageTemplate } from '../utils/messageTemplates/StarfallMessageTemplate.js';
import gameConfig from '../games/gameConfig.js';

// Mock configuration for testing
const testConfig = {
  ...gameConfig,
  minReward: 100,
  maxReward: 1000,
  minWinners: 1,
  maxWinners: 3
};

// Test RewardService
function testRewardService() {
  console.log('Testing RewardService...');
  
  const rewardService = new RewardService(testConfig);
  
  // Test reward generation
  const reward = rewardService.generateRandomReward();
  console.log(`Generated reward: ${reward}`);
  console.log(`Reward validation: ${rewardService.validateReward(reward)}`);
  
  // Test winner count generation
  const winnerCount = rewardService.getRandomWinnerCount();
  console.log(`Generated winner count: ${winnerCount}`);
  console.log(`Winner count validation: ${rewardService.validateWinnerCount(winnerCount)}`);
  
  // Test reward type formatting
  const rewardTypeEnd = rewardService.getRewardTypeEnd(reward);
  console.log(`Reward type end for ${reward}: ${rewardTypeEnd}`);
  
  console.log('RewardService tests completed\n');
}

// Test ParticipantManager
function testParticipantManager() {
  console.log('Testing ParticipantManager...');
  
  const participantManager = new ParticipantManager();
  
  // Test adding participants
  participantManager.addParticipant('user1');
  participantManager.addParticipant('user2');
  participantManager.addParticipant('user3');
  participantManager.addParticipant('user1'); // Should not add duplicate
  
  console.log(`Participant count: ${participantManager.getParticipantCount()}`);
  console.log(`Participants: ${participantManager.getParticipants()}`);
  
  // Test winner selection
  const winners = participantManager.getWinners(2);
  console.log(`Selected winners: ${winners}`);
  
  // Test finding users
  const user = participantManager.findUser(winners[0]);
  console.log(`Found user for ID ${winners[0]}: ${user}`);
  
  console.log('ParticipantManager tests completed\n');
}

// Test MessageTemplate
function testMessageTemplate() {
  console.log('Testing MessageTemplate...');
  
  const messageTemplate = new MessageTemplate(testConfig);
  
  // Test message preparation
  const context = {
    reward: 500,
    winnerCount: 2,
    currentGameLength: 30000
  };
  
  const message = messageTemplate.prepareMessage(
    testConfig.gameStartMessage, 
    context
  );
  console.log(`Prepared message: ${message}`);
  
  // Test winner formatting
  const winnerMessage = messageTemplate.formatWinners(['user1', 'user2'], 500);
  console.log(`Winner message: ${winnerMessage}`);
  
  // Test template validation
  const isValid = messageTemplate.validateTemplate(testConfig.gameStartMessage);
  console.log(`Template validation: ${isValid}`);
  
  console.log('MessageTemplate tests completed\n');
}

// Test GameTimer
async function testGameTimer() {
  console.log('Testing GameTimer...');
  
  const gameTimer = new GameTimer();
  
  // Test wait functionality
  const startTime = Date.now();
  await gameTimer.wait(100);
  const endTime = Date.now();
  console.log(`Wait time: ${endTime - startTime}ms`);
  
  // Test timer management
  let timerCalled = false;
  gameTimer.startTimer('test', 50, () => {
    timerCalled = true;
    console.log('Timer callback executed');
  });
  
  await gameTimer.wait(100);
  console.log(`Timer called: ${timerCalled}`);
  
  console.log('GameTimer tests completed\n');
}

// Test MessageService (with mocked client)
function testMessageService() {
  console.log('Testing MessageService...');
  
  const messageService = new MessageService();
  
  // Mock client for testing
  const mockClient = {
    doAction: async (actionId, params) => {
      console.log(`Mock client action: ${actionId}`, params);
      return { success: true };
    }
  };
  
  messageService.setClient(mockClient);
  
  // Test configuration
  console.log('Action IDs:', messageService.actionIds);
  console.log('StreamElements config:', messageService.streamElementsConfig);
  
  console.log('MessageService tests completed\n');
}

// Run all tests
async function runTests() {
  console.log('Starting Loot Drop Game Tests...\n');
  
  try {
    testRewardService();
    testParticipantManager();
    testMessageTemplate();
    await testGameTimer();
    testMessageService();
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
