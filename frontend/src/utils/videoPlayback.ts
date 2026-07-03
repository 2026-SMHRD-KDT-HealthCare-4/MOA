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

  const g = globalThis as typeof globalThis & {
    HTMLMediaElement?: typeof HTMLMediaElement;
    HTMLVideoElement?: typeof HTMLVideoElement;
  };
  const mediaElement = g.HTMLMediaElement;
  const videoElement = g.HTMLVideoElement;

  if (!mediaElement?.prototype?.play) return;

  const originalPlay = mediaElement.prototype.play;
  mediaElement.prototype.play = function guardedPlay(this: HTMLMediaElement) {
    // iOS Safari 는 playsinline 이 없으면 <video> 를 재생 시 전체화면으로 강제 전환한다.
    // 아바타 영상은 '장식'이므로 매 재생마다 인라인·무컨트롤을 강제해 전체화면·PiP·
    // 컨트롤 오버레이가 뜨지 않게 한다. (iOS=playsinline / Android=controlsList)
    if (videoElement && this instanceof videoElement) {
      const el = this as HTMLVideoElement;
      try {
        el.playsInline = true;
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        el.setAttribute("disablepictureinpicture", "");
        el.controls = false;
        (el as unknown as { controlsList?: string }).controlsList =
          "nodownload nofullscreen noremoteplayback";
      } catch {
        // 속성 설정 실패가 재생 자체를 막지는 않는다.
      }
    }
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
