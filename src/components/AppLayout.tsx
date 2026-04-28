import { ReactNode } from "react";
import { AppSidebar, MobileBottomNav } from "./Sidebar";
import { Search, Bell } from "lucide-react";
import { IbonaLogo } from "./IbonaLogo";
import { Link } from "@tanstack/react-router";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
          <Link to="/" className="lg:hidden">
            <IbonaLogo />
          </Link>
          <div className="hidden sm:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search videos, creators, sounds..."
                className="w-full rounded-full bg-surface border border-border pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
              />
            </div>
          </div>
          <div className="flex-1 sm:hidden" />
          <button className="h-9 w-9 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-elevated transition" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <div className="h-9 w-9 rounded-full ring-2 ring-primary/40" style={{ background: "var(--gradient-brand)" }} />
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-10 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
