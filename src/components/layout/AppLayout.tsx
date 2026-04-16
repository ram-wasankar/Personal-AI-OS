import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import DashboardView from "../views/DashboardView";
import ChatView from "../views/ChatView";
import NotesView from "../views/NotesView";
import DocumentsView from "../views/DocumentsView";
import MemoryView from "../views/MemoryView";
import InsightsView from "../views/InsightsView";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-hidden">
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
