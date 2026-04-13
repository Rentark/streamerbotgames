import { validateTranscriptionWithLLM } from '../../../services/LLMConnectorService.js';

export const mehCommand = {
  name: 'meh',
  aliases: new Set(['!meh', '!бля', 'бля', '!ой', '!,bz', ',bz']),
  cooldown: 0, // handled externally via canUseMeh sliding window

  async execute(ctx) {
    const { user, previousMessage, reply, services } = ctx;
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
    const validation = await validateTranscriptionWithLLM(transcribed, user);
    if (!validation?.finalText) return;

    const response = config.responseTemplate
      .replace('{sender}', user)
      .replace('{text}', validation.finalText);

    await reply(response);
  }
};
