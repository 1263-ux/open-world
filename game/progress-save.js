// Storage is injected so errors/private-mode quota never stop gameplay.
export function createProgressSave({
  storage,
  read,
  key = "dream-post-office-recovery-v1",
  interval = 5,
  onStatus = () => {},
}) {
  let elapsed = 0,
    lastAttempt = null,
    status = null;
  function notify(ok) {
    if (status === ok) return;
    status = ok;
    try { onStatus(ok); } catch {}
  }
  const critical = (s) =>
    JSON.stringify([
      s.stage,
      s.folds,
      s.solved,
      s.rain,
      s.windmill,
      s.collected,
    ]);
  function flush() {
    try {
      const data = read();
      // Record the attempted state even on quota failure: next frame is not a retry.
      lastAttempt = critical(data.story);
      elapsed = 0;
      storage.setItem(key, JSON.stringify(data));
      notify(true);
      return true;
    } catch {
      notify(false);
      return false;
    }
  }
  function changed() {
    const signature = critical(read().story);
    return signature !== lastAttempt ? flush() : false;
  }
  function tick(wall) {
    if (Number.isFinite(wall) && wall >= 0) elapsed += wall;
    if (elapsed >= interval) {
      elapsed = 0;
      return flush();
    }
    return false;
  }
  return { flush, changed, tick };
}
export function bindProgressLifecycle(saver, doc, win) {
  const hidden = () => {
      if (doc.hidden) saver.flush();
    },
    pagehide = () => saver.flush();
  doc.addEventListener("visibilitychange", hidden);
  win.addEventListener("pagehide", pagehide);
  return () => {
    doc.removeEventListener("visibilitychange", hidden);
    win.removeEventListener("pagehide", pagehide);
  };
}
export function captureInteraction(target, getPlayer, story, emit) {
  const { id, x, z } = target;
  return (action = id) => {
    const p = getPlayer();
    return emit(
      story.interact(action, {
        distance: Math.hypot(p.x - x, p.z - z),
        maxDistance: 2.3,
      }),
    );
  };
}
export function allowSafetyReset(panelOpen) {
  return !panelOpen;
}
export function validateLoadedPosition(player, recover) {
  if (player.blockedAt(player.x, player.z)) {
    recover();
    return false;
  }
  return true;
}
