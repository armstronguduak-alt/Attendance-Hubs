import React from "react";
import { Sun, Moon, LogOut, LogIn, Users, ShieldAlert, FileSpreadsheet } from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";

interface HeaderProps {
  currentView: string;
  navigate: (view: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  openAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, navigate, darkMode, toggleDarkMode, openAuthModal }) => {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 z-40 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200">
            <Users size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            AttendanceHub
          </span>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-4">
          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => navigate("/")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentView === "/"
                  ? "bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-950"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Home
            </button>

            {user && (
              <button
                onClick={() => navigate("/dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  currentView === "/dashboard"
                    ? "bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <FileSpreadsheet size={13} />
                Dashboard
              </button>
            )}

            {user?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  currentView === "/admin"
                    ? "bg-rose-50 dark:bg-rose-100 text-rose-600 dark:text-rose-950"
                    : "text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                }`}
              >
                <ShieldAlert size={13} />
                Admin Panel
              </button>
            )}
          </nav>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition duration-200 cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Auth Button */}
          {loading ? (
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-800 border-t-transparent animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {user.displayName || "Creator"}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {user.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                <LogOut size={13} />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs hover:shadow-md cursor-pointer"
            >
              <LogIn size={13} />
              Sign In
            </button>
          )}
        </div>
      </div>
      
      {/* Mobile nav indicator bar */}
      <div className="sm:hidden border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 px-4 py-2 flex gap-2">
        <button
          onClick={() => navigate("/")}
          className={`flex-1 text-center py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
            currentView === "/" ? "bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Home
        </button>
        {user && (
          <button
            onClick={() => navigate("/dashboard")}
            className={`flex-1 text-center py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              currentView === "/dashboard" ? "bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Dashboard
          </button>
        )}
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin")}
            className={`flex-1 text-center py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              currentView === "/admin" ? "bg-rose-50 dark:bg-rose-100 text-rose-600 dark:text-rose-950" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Admin
          </button>
        )}
      </div>
    </header>
  );
};
