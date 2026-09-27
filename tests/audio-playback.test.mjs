import assert from "node:assert/strict";
import test from "node:test";
import { startAudioPlayback } from "../src/audioPlayback.js";

test("starts audio and resumes its context synchronously inside a user gesture", async () => {
  const calls = [];
  const context = {
    state: "suspended",
    resume() {
      calls.push("resume");
      return Promise.resolve();
    },
  };
  const audio = {
    play() {
      calls.push("play");
      return Promise.resolve();
    },
  };

  const playback = startAudioPlayback(audio, context);
  assert.deepEqual(calls, ["resume", "play"]);
  await playback;
});

test("reports browser autoplay rejection so the UI can offer a click to play", async () => {
  const blocked = new Error("User gesture required");
  blocked.name = "NotAllowedError";

  await assert.rejects(
    startAudioPlayback(
      { play: () => Promise.reject(blocked) },
      { state: "running" },
    ),
    { name: "NotAllowedError" },
  );
});
