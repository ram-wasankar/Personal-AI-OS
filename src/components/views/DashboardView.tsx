import { useEffect, useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Clock3,
  FileText,
  MessageSquare,
  Sparkles,
  StickyNote,
  Upload,
  Zap,
} from "lucide-react";

import { getDashboard, type ApiDashboard } from "@/lib/api";

const activityIcons: Record<string, ComponentType<{ className?: string }>> = {
  note: StickyNote,
  document: FileText,
  chat: MessageSquare,
  memory: Brain,
};

const accentByType: Record<string, string> = {
  primary: "from-primary/25 to-primary/5 text-primary border-primary/20",
  accent: "from-accent/25 to-accent/5 text-accent border-accent/20",
  warning: "from-warning/25 to-warning/5 text-warning border-warning/20",
  success: "from-success/25 to-success/5 text-success border-success/20",
};

const DashboardView = () => {
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getDashboard();
        setDashboard(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const navigateTo = (view: string) => {
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: view }));
  };

  const summary = dashboard?.summary ?? { notes: 0, documents: 0, conversations: 0, memories: 0 };
  const memoryConfidence = dashboard?.memoryConfidence ?? 0;
  const insights = dashboard?.insights?.length
    ? dashboard.insights
    : ["Start by adding notes and uploading docs. Your workspace will become context-aware."];

  const metricCards = useMemo(
    () => [
      {
        title: "Notes",
        value: summary.notes,
        icon: StickyNote,
        hint: "Thought fragments and drafts",
      },
      {
        title: "Documents",
        value: summary.documents,
        icon: FileText,
        hint: "Indexed reference material",
      },
      {
        title: "Conversations",
        value: summary.conversations,
        icon: MessageSquare,
        hint: "Persistent chat context",
      },
      {
        title: "Memories",
        value: summary.memories,
        icon: Brain,
        hint: "Extracted preferences and goals",
      },
    ],
    [summary],
  );

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative overflow-hidden rounded-3xl border border-glass-border/40 bg-gradient-to-br from-primary/20 via-surface-1 to-accent/15 p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative z-10 grid gap-7 lg:grid-cols-[1.25fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Neural Workspace Online
              </div>

              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.08] text-foreground">
                Command your second brain,
                <span className="block text-gradient-primary">not just a notes app.</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm sm:text-base text-secondary-foreground leading-relaxed">
                Synapse Atlas is tracking {summary.notes} notes, {summary.documents} documents, and {summary.conversations} conversations.
                Ask questions, upload files, and let the system continuously improve retrieval quality.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigateTo("chat")}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-primary"
                >
                  <Zap className="w-4 h-4" />
                  Start AI Session
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigateTo("documents")}
                  className="inline-flex items-center gap-2 rounded-xl border border-glass-border/50 bg-surface-0/70 px-4 py-2.5 text-sm font-semibold text-foreground"
                >
                  <Upload className="w-4 h-4" />
                  Upload New Source
                </motion.button>
                <motion.button
                  whileHover={{ x: 2 }}
                  onClick={() => navigateTo("insights")}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-secondary-foreground hover:text-foreground transition-colors"
                >
                  Explore insights
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            <div className="rounded-2xl border border-glass-border/40 bg-surface-0/70 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold">System Pulse</p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-glass-border/45 bg-surface-1/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Memory confidence</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{memoryConfidence.toFixed(1)}%</p>
                  <div className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                      style={{ width: `${Math.min(Math.max(memoryConfidence, 4), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-glass-border/45 bg-surface-1/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm text-foreground font-medium">
                    {loading
                      ? "Syncing dashboard..."
                      : "All systems responsive. Retrieval, memory, and activity channels are active."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {metricCards.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.06, duration: 0.4 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground font-semibold">{metric.title}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{metric.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <metric.icon className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{metric.hint}</p>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 sm:gap-5">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-semibold text-foreground">Operator Insights</h2>
            </div>

            <div className="space-y-3">
              {insights.slice(0, 4).map((insight, index) => (
                <div key={`${insight}-${index}`} className="rounded-xl border border-glass-border/35 bg-surface-1/70 px-3.5 py-3">
                  <p className="text-sm text-foreground leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-secondary-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Signal Stream</h2>
            </div>

            <div className="space-y-2">
              {dashboard?.recentActivity?.map((item, index) => {
                const ItemIcon = activityIcons[item.type] || Brain;
                const accentClass = accentByType[item.accent] ?? accentByType.primary;
                return (
                  <motion.div
                    key={`${item.type}-${item.detail}-${index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.06, duration: 0.35 }}
                    className="rounded-xl border border-glass-border/35 bg-surface-1/65 px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-lg border bg-gradient-to-br flex items-center justify-center shrink-0 ${accentClass}`}>
                          <ItemIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{item.detail}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                    </div>
                  </motion.div>
                );
              })}

              {!loading && !dashboard?.recentActivity?.length && (
                <p className="text-xs text-muted-foreground px-1 py-2">
                  No activity yet. Create a note, upload a document, or open chat to generate signal.
                </p>
              )}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

export default DashboardView;
