import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

export function NavItem({ to, icon, label, end = false }: NavItemProps) {
  const location = useLocation();
  const isActive = end 
    ? location.pathname === to 
    : location.pathname.startsWith(to);

  return (
    <RouterNavLink
      to={to}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
        "hover:bg-secondary/80",
        isActive
          ? "text-primary bg-secondary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </RouterNavLink>
  );
}
