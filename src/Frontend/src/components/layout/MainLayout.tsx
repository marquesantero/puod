import { useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const showSidebar = location.pathname !== "/setup";

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {showSidebar ? <Sidebar /> : null}
      <div className="flex flex-col flex-1 relative">
        <div className="relative z-50 overflow-visible">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-4 app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
