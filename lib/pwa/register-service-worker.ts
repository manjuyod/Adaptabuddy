let hasRegistered = false;

export function registerServiceWorker() {
  if (hasRegistered) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  hasRegistered = true;

  const register = async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.info("[adaptabuddy] service worker registered");
    } catch (error) {
      console.warn("[adaptabuddy] service worker registration failed", error);
    }
  };

  if (document.readyState === "complete") {
    void register();
  } else {
    window.addEventListener(
      "load",
      () => {
        void register();
      },
      { once: true }
    );
  }
}
