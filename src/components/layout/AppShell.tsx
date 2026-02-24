import { Outlet, Link } from "react-router-dom";
import { NavItem } from "@/components/navigation/NavItem";
import { 
  Clock, 
  CalendarDays, 
  Sparkles, 
  FolderInput, 
  BookOpen, 
  Settings
} from "lucide-react";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mr-8">
            <img
              src="/branding/snapback-angel.png"
              alt="SnapBack angel logo"
              className="h-7 w-7 rounded-md object-cover"
              loading="eager"
            />
            <span className="font-bold text-lg text-foreground">SnapBack</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 flex-1">
            <NavItem 
              to="/" 
              icon={<Clock className="h-4 w-4" />} 
              label="Timeline" 
              end 
            />
            <NavItem 
              to="/on-this-day" 
              icon={<CalendarDays className="h-4 w-4" />} 
              label="On This Day" 
            />
            <NavItem 
              to="/recaps" 
              icon={<Sparkles className="h-4 w-4" />} 
              label="Recaps" 
            />
            <NavItem 
              to="/import" 
              icon={<FolderInput className="h-4 w-4" />} 
              label="Import" 
            />
            <NavItem 
              to="/guide" 
              icon={<BookOpen className="h-4 w-4" />} 
              label="Guide" 
            />
            <NavItem 
              to="/settings" 
              icon={<Settings className="h-4 w-4" />} 
              label="Settings" 
            />
          </nav>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="hidden sm:inline">8,016 memories</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="w-full text-center text-xs opacity-60 py-6 mt-10">
        Ideated by Viraj Parmaj
      </footer>
    </div>
  );
}
