let introAudio = null;
let pendingPlay = null;

// Start in the portal card's click handler when possible, so the browser sees
// a real user gesture. Direct visits also try once when the dialogue mounts.
export function startIntroAudio(url) {
  if (!introAudio) {
    introAudio = new Audio(url);
    introAudio.preload = "auto";
  }
  if (!introAudio.paused || pendingPlay) return;

  const audio = introAudio;
  try {
    pendingPlay = Promise.resolve(audio.play())
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.info("Yuanbai introduction autoplay unavailable", { name: error?.name || "UnknownError" });
        }
      })
      .finally(() => {
        if (introAudio === audio) pendingPlay = null;
      });
  } catch (error) {
    pendingPlay = null;
    console.info("Yuanbai introduction autoplay unavailable", { name: error?.name || "UnknownError" });
  }
}

export function stopIntroAudio() {
  const audio = introAudio;
  introAudio = null;
  pendingPlay = null;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
