import { rolesMap } from '../../../config/config.js';
import { validateTranscriptionWithLLM } from '../../../services/LLMConnectorService.js';

function isUserAllowedToBypassValidation(userRole, isSubscriber, monthsSubscribed, isFromSharedChatGuest) {
  return (userRole === rolesMap['1'] && !isSubscriber) || (userRole === rolesMap['1'] && isSubscriber && monthsSubscribed < 3) || (userRole === rolesMap['1'] && isFromSharedChatGuest);
}

export const mehCommand = {
  name: 'meh',
  aliases: new Set(['!meh', '!бля', 'бля', '!ой', '!,kz', ',kz']),
  cooldown: 0, // handled externally via canUseMeh sliding window

  async execute(ctx) {
    const { user, previousMessage, reply, services, userRole, isSubscriber, isFromSharedChatGuest, monthsSubscribed } = ctx;
    const { config } = services;

    const prev = previousMessage;
    if (!prev || typeof prev !== 'string') return;

    const trimmed = prev.trim();

    // Ignore if previous message was also a command or too short
    if (!trimmed || trimmed.startsWith('!') || config.commands.meh.has(trimmed)) return;
    if (trimmed.length < config.transcription.minPreviousMessageChars) return;

    // Transcribe EN→UKR keyboard layout
    const transcribed = services.transcribe(trimmed);
    if (!transcribed || transcribed === trimmed) return;

    const cyrillicCount = (transcribed.match(/[а-яіїєґ]/gi) ?? []).length;
    if (cyrillicCount <= config.transcription.minUkrCyrillicLetters) return;

    // LLM validation
    const validation = isUserAllowedToBypassValidation(userRole, isSubscriber, monthsSubscribed, isFromSharedChatGuest) ? await validateTranscriptionWithLLM(transcribed, user) : { isValid: true, finalText: transcribed };
    if (!validation?.finalText) return;

    const response = config.responseTemplate
      .replace('{sender}', user)
      .replace('{text}', validation.finalText);

    await reply(response);
  }
};
