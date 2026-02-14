"use strict";

(() => {
  try {
    window.__PUOD_COOKIE_BRIDGE__ = true;
    document.documentElement.dataset.puodCookieBridge = "1";
    window.dispatchEvent(new CustomEvent("puod-cookie-bridge-ready"));
  } catch {
    // Ignore errors to avoid breaking host pages.
  }
})();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "PUOD_COOKIE_REQUEST") return;

  chrome.runtime.sendMessage(
    { type: "getCookies", domain: data.domain },
    (response) => {
      window.postMessage(
        {
          type: "PUOD_COOKIE_RESPONSE",
          requestId: data.requestId,
          success: response?.success,
          cookieHeader: response?.cookieHeader,
          error: response?.error,
        },
        "*"
      );
    }
  );
});
