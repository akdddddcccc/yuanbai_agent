export const SPEECH_TURN_SECONDS = 2.2;
const smoothstep = value => value * value * (3 - 2 * value);

// A turn is triggered by the phase transition, never by individual audio pulses.
export function createSpeechMotion() {
  let previousPhase = 'idle';
  let startedAt = null;
  let completedAngle = 0;
  let active = false;
  return {
    update(phase, time) {
      if (phase === 'speaking' && previousPhase !== 'speaking' && !active) {
        startedAt = time;
        active = true;
      }
      previousPhase = phase;
      const progress = startedAt === null ? 0
        : Math.min(1, Math.max(0, (time - startedAt) / SPEECH_TURN_SECONDS));
      if (active && progress === 1) {
        completedAngle += Math.PI * 2;
        active = false;
      }
      // Finish a short response's turn even if its audio ends early.
      const stretch = phase === 'speaking' && !active && startedAt !== null
        ? smoothstep(Math.min(1, Math.max(0, (time - startedAt - SPEECH_TURN_SECONDS) / .45))) : 0;
      return {
        turning: active,
        angle: completedAngle + (active ? Math.PI * 2 * smoothstep(progress) : 0),
        glow: active ? Math.sin(Math.PI * progress) : 0,
        stretch,
      };
    },
  };
}
