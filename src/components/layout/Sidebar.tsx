import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  StickyNote,
  FileText,
  Brain,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  LogOut,
} from "lucide-react";
import { ApiUser } from "@/lib/api";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user: ApiUser | null;
  onLogout: () => Promise<void>;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "insights", label: "Insights", icon: Sparkles },
];

const Sidebar = ({ activeView, onViewChange, user, onLogout }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const userInitials = useMemo(() => {
    if (!user?.fullName) {
      return "SK";
    }
    return user.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [user]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 252 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-screen flex flex-col bg-sidebar relative z-20 shrink-0 border-r border-sidebar-border/70"
    >
      <div className="px-3 pt-3 pb-2">
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-2.5 py-2.5">
          <div className="flex items-center gap-2.5 h-9 shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-accent glow-sm-primary">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-semibold leading-none text-sidebar-accent-foreground">Synapse Atlas</p>
                  <p className="text-[10px] mt-1 text-sidebar-foreground">Memory-native workspace</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2.5 space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 relative group ${
                isActive
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/25 to-accent/20"
                  style={{
                    boxShadow: "0 0 24px -8px hsl(var(--primary) / 0.4), inset 0 1px 0 hsl(var(--primary) / 0.2)",
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              {!isActive && (
                <div className="absolute inset-0 rounded-xl bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}

              <item.icon className={`w-4 h-4 shrink-0 relative z-10 transition-colors duration-200 ${
                isActive ? "text-primary" : "group-hover:text-sidebar-accent-foreground"
              }`} />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap relative z-10"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="px-2.5 pb-2">
        <button
          onClick={() => {
            void onLogout();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-all duration-200 text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {!collapsed && user && (
        <div className="px-3 pb-2">
          <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/70 px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user.fullName}</p>
              <p className="text-[11px] text-sidebar-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-2.5 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-all duration-200 text-xs"
        >
          {collapsed ? (
            <ChevronsRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronsLeft className="w-3.5 h-3.5" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Collapse
              </motion.span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
