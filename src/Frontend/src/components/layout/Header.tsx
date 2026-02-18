import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect, useRef } from "react";

export default function Header() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Decode JWT to get user email
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserEmail(payload.email || payload.sub || "User");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserEmail("User");
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login");
  };

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="app-header relative flex items-center justify-end border-b border-blue-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-blue-900/60 dark:bg-slate-900/80 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200">
          <span>{t("language")}</span>
          <select
            className="bg-transparent text-[11px] font-semibold outline-none"
            value={locale}
            onChange={(event) => setLocale(event.target.value as "en" | "pt")}
          >
            <option value="en">{t("languageOptionEn")}</option>
            <option value="pt">{t("languageOptionPt")}</option>
          </select>
        </div>

        <Button onClick={toggleTheme} variant="outline" size="sm" className="gap-2">
          {theme === "dark" ? (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <path
                d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.5-7.5-1.4 1.4M6 18l-1.4 1.4M18 18l-1.4-1.4M6 6 4.6 4.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"
                fill="currentColor"
              />
            </svg>
          )}
        </Button>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
              {getInitials(userEmail)}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{userEmail.split('@')[0]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 z-[9999]">
              <div className="border-b border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{userEmail.split('@')[0]}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/profile");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t("profile") || "Profile"}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" />
                    <path d="M14 12H3m0 0 3-3m-3 3 3 3" strokeLinecap="round" />
                  </svg>
                  {t("logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
