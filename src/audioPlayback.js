// Call both methods in the same click handler. Waiting for resume() first can
// consume the browser's user gesture before play() gets a chance to run.
export function startAudioPlayback(audio, context) {
  let resumePromise;
  try {
    resumePromise = context.state === "suspended" ? context.resume() : Promise.resolve();
  } catch (error) {
    resumePromise = Promise.reject(error);
  }

  let playPromise;
  try {
    playPromise = audio.play();
  } catch (error) {
    playPromise = Promise.reject(error);
  }

  return Promise.all([resumePromise, playPromise]);
}
