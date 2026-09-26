import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechMotion, SPEECH_TURN_SECONDS as duration } from '../src/speechMotion.js';

test('one full turn with glow precedes any voice expansion', () => {
  const motion = createSpeechMotion();
  assert.equal(motion.update('thinking', 0).turning, false);
  assert.equal(motion.update('speaking', 1).angle, 0);
  let previous = 0;
  for (let i = 1; i < 100; i++) {
    const frame = motion.update('speaking', 1 + duration * i / 100);
    assert.ok(frame.angle > previous && frame.angle < Math.PI * 2);
    assert.equal(frame.stretch, 0);
    assert.ok(frame.glow > 0);
    previous = frame.angle;
  }
  const end = motion.update('speaking', 1 + duration);
  assert.equal(end.angle, Math.PI * 2);
  assert.equal(end.glow, 0);
  assert.equal(end.turning, false);
  assert.equal(end.stretch, 0);
  const next = motion.update('speaking', 1 + duration + .6);
  assert.equal(next.angle, end.angle, 'the model must not rotate backwards after a turn');
  assert.equal(next.stretch, 1);
  assert.equal(motion.update('speaking', 100).angle, Math.PI * 2);
});

test('a new answer turns again, while idle and thinking do not trigger turns', () => {
  const motion = createSpeechMotion();
  motion.update('speaking', 0);
  motion.update('speaking', 3);
  assert.equal(motion.update('idle', 4).stretch, 0);
  assert.equal(motion.update('thinking', 5).angle, Math.PI * 2);
  assert.equal(motion.update('speaking', 6).turning, true);
  assert.equal(motion.update('speaking', 9).angle, Math.PI * 4);
});

test('a short or interrupted answer finishes its turn without stretching in idle', () => {
  const motion = createSpeechMotion();
  motion.update('speaking', 0);
  const interrupted = motion.update('idle', .4);
  assert.equal(interrupted.turning, true);
  assert.equal(interrupted.stretch, 0);
  const end = motion.update('idle', 3);
  assert.equal(end.angle, Math.PI * 2);
  assert.equal(end.stretch, 0);
  assert.equal(end.glow, 0);
});
