"use strict";

const normalizeDomain = (value) => value.trim().replace(/^\.+/, "");

const buildCookieHeader = (cookies) =>
  cookies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "getCookies") {
    return;
  }

  const domain = normalizeDomain(message.domain || "");
  if (!domain) {
    sendResponse({ success: false, error: "Cookie domain is required." });
    return;
  }

  chrome.cookies.getAll({ domain }, (cookies) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (!cookies || cookies.length === 0) {
      sendResponse({ success: false, error: "No cookies found for the provided domain." });
      return;
    }

    sendResponse({ success: true, cookieHeader: buildCookieHeader(cookies) });
  });

  return true;
});
