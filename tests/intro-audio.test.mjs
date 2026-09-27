import assert from "node:assert/strict";
import test from "node:test";
import { startIntroAudio, stopIntroAudio } from "../src/introAudio.js";

test("starts the introduction once and interrupts it when recording begins", async () => {
  const originalAudio = globalThis.Audio;
  const instances = [];
  globalThis.Audio = class {
    constructor(url) {
      this.url = url;
      this.paused = true;
      this.currentTime = 1;
      this.playCalls = 0;
      this.pauseCalls = 0;
      instances.push(this);
    }
    play() {
      this.playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
  };

  try {
    startIntroAudio("/audio/yuanbai-intro.mp3");
    startIntroAudio("/audio/yuanbai-intro.mp3");
    assert.equal(instances.length, 1);
    assert.equal(instances[0].playCalls, 1);

    stopIntroAudio();
    assert.equal(instances[0].pauseCalls, 1);
    assert.equal(instances[0].currentTime, 0);
  } finally {
    stopIntroAudio();
    globalThis.Audio = originalAudio;
  }
});
