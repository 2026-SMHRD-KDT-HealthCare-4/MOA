let webPlayGuardInstalled = false;

function isInterruptedPlayError(error: unknown) {
  const maybeError = error as { name?: string; message?: string } | null;
  return (
    maybeError?.name === "AbortError" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("play() request was interrupted")
  );
}

export function installWebVideoPlayGuard() {
  if (webPlayGuardInstalled || typeof globalThis === "undefined") return;

  const mediaElement = (globalThis as typeof globalThis & {
    HTMLMediaElement?: typeof HTMLMediaElement;
  }).HTMLMediaElement;

  if (!mediaElement?.prototype?.play) return;

  const originalPlay = mediaElement.prototype.play;
  mediaElement.prototype.play = function guardedPlay(this: HTMLMediaElement) {
    const result = originalPlay.call(this);
    if (result && typeof result.catch === "function") {
      return result.catch((error: unknown) => {
        if (isInterruptedPlayError(error)) return;
        throw error;
      });
    }
    return result;
  };

  webPlayGuardInstalled = true;
}

export function safePlay(player: { play: () => void | Promise<void> }) {
  try {
    const result = player.play();
    if (result && typeof (result as Promise<void>).then === "function") {
      return Promise.resolve(result)
        .then(() => true)
        .catch((error) => {
          if (!isInterruptedPlayError(error)) {
            console.warn("[VIDEO PLAY BLOCKED]");
          }
          return false;
        });
    }
    return Promise.resolve(true);
  } catch (error) {
    if (!isInterruptedPlayError(error)) {
      console.warn("[VIDEO PLAY BLOCKED]");
    }
    return Promise.resolve(false);
  }
}
