"use strict";

const DEFAULT_API_BASE = "http://localhost:5278";

const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const integrationIdInput = document.getElementById("integrationId");
const cookieDomainInput = document.getElementById("cookieDomain");
const accessTokenInput = document.getElementById("accessToken");
const useTabTokenButton = document.getElementById("useTabToken");
const sendCookiesButton = document.getElementById("sendCookies");
const statusEl = document.getElementById("status");

const setStatus = (message, type) => {
  statusEl.textContent = message || "";
  statusEl.classList.remove("error", "success");
  if (type) {
    statusEl.classList.add(type);
  }
};

const getActiveTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });

const normalizeDomain = (value) => value.trim().replace(/^\\.+/, "");

const saveSettings = () => {
  chrome.storage.local.set({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    integrationId: integrationIdInput.value.trim(),
    cookieDomain: cookieDomainInput.value.trim(),
  });
};

const loadSettings = async () => {
  const settings = await chrome.storage.local.get([
    "apiBaseUrl",
    "integrationId",
    "cookieDomain",
  ]);

  apiBaseUrlInput.value = settings.apiBaseUrl || DEFAULT_API_BASE;
  integrationIdInput.value = settings.integrationId || "";
  cookieDomainInput.value = settings.cookieDomain || "";

  if (!cookieDomainInput.value) {
    const tab = await getActiveTab();
    if (tab?.url) {
      try {
        const url = new URL(tab.url);
        cookieDomainInput.value = url.hostname;
      } catch {
        // Ignore invalid URLs (e.g. chrome://)
      }
    }
  }
};

const ensureHostPermission = (domain) =>
  new Promise((resolve) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      resolve(false);
      return;
    }
    const origin = `*://${normalized}/*`;
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      resolve(Boolean(granted));
    });
  });

const getCookiesHeader = async (domain) => {
  const normalized = normalizeDomain(domain);
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain: normalized }, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
        return;
      }
      if (!cookies || cookies.length === 0) {
        reject("No cookies found for the provided domain.");
        return;
      }
      const header = cookies
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      resolve(header);
    });
  });
};

const sendCookies = async () => {
  setStatus("");

  const apiBaseUrl = apiBaseUrlInput.value.trim() || DEFAULT_API_BASE;
  const integrationId = integrationIdInput.value.trim();
  const cookieDomain = cookieDomainInput.value.trim();
  const token = accessTokenInput.value.trim();

  if (!integrationId) {
    setStatus("Integration ID is required.", "error");
    return;
  }
  if (!cookieDomain) {
    setStatus("Cookie domain is required.", "error");
    return;
  }
  if (!token) {
    setStatus("Access token is required.", "error");
    return;
  }

  sendCookiesButton.disabled = true;

  try {
    const permissionGranted = await ensureHostPermission(cookieDomain);
    if (!permissionGranted) {
      setStatus("Permission denied for cookie domain.", "error");
      return;
    }

    const cookieHeader = await getCookiesHeader(cookieDomain);

    const response = await fetch(
      `${apiBaseUrl.replace(/\\/$/, "")}/api/integration/${integrationId}/cookie-header`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cookieHeader,
          cookieDomain: normalizeDomain(cookieDomain),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to send cookies.");
    }

    setStatus("Cookies sent successfully.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, "error");
  } finally {
    sendCookiesButton.disabled = false;
  }
};

const useTokenFromTab = async () => {
  setStatus("");
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab found.", "error");
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => localStorage.getItem("accessToken"),
    },
    (results) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, "error");
        return;
      }
      const token = results?.[0]?.result;
      if (!token) {
        setStatus("No access token found in the current tab.", "error");
        return;
      }
      accessTokenInput.value = token;
      setStatus("Token loaded from tab.", "success");
    }
  );
};

apiBaseUrlInput.addEventListener("input", saveSettings);
integrationIdInput.addEventListener("input", saveSettings);
cookieDomainInput.addEventListener("input", saveSettings);
useTabTokenButton.addEventListener("click", useTokenFromTab);
sendCookiesButton.addEventListener("click", sendCookies);

loadSettings();
