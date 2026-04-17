import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import DashboardView from "../views/DashboardView";
import ChatView from "../views/ChatView";
import NotesView from "../views/NotesView";
import DocumentsView from "../views/DocumentsView";
import MemoryView from "../views/MemoryView";
import InsightsView from "../views/InsightsView";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const views: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  chat: ChatView,
  notes: NotesView,
  documents: DocumentsView,
  memory: MemoryView,
  insights: InsightsView,
};

const AppLayout = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const { user, logout } = useAuth();
  const ActiveComponent = views[activeView] || DashboardView;

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const targetView = customEvent.detail;
      if (targetView && views[targetView]) {
        setActiveView(targetView);
      }
    };

    window.addEventListener("app:navigate", onNavigate as EventListener);
    return () => {
      window.removeEventListener("app:navigate", onNavigate as EventListener);
    };
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-background app-atmosphere">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-24 right-8 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <Sidebar activeView={activeView} onViewChange={setActiveView} user={user} onLogout={logout} />
      <main className="relative z-10 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AppLayout;
