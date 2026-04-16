import { useEffect, useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Sparkles, Zap, Clock, FileText, MessageSquare, StickyNote } from "lucide-react";

import { getDashboard, type ApiDashboard } from "@/lib/api";

const accentColors = {
  primary: {
    dot: "bg-primary",
    glow: "shadow-[0_0_8px_hsl(var(--primary)/0.4)]",
    text: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/10",
  },
  accent: {
    dot: "bg-accent",
    glow: "shadow-[0_0_8px_hsl(var(--accent)/0.4)]",
    text: "text-accent",
    bg: "bg-accent/5",
    border: "border-accent/10",
  },
  warning: {
    dot: "bg-warning",
    glow: "shadow-[0_0_8px_hsl(var(--warning)/0.4)]",
    text: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/10",
  },
  success: {
    dot: "bg-success",
    glow: "shadow-[0_0_8px_hsl(var(--success)/0.4)]",
    text: "text-success",
    bg: "bg-success/5",
    border: "border-success/10",
  },
};

const activityIcons: Record<string, ComponentType<{ className?: string }>> = {
  note: StickyNote,
  document: FileText,
  chat: MessageSquare,
  memory: Brain,
};

const insightColors = ["primary", "accent", "warning", "success"] as const;

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

  const smartInsights = useMemo(() => {
    const fallback = ["Your workspace is ready. Start adding notes and documents to build context."];
    const insights = dashboard?.insights?.length ? dashboard.insights : fallback;

    return insights.slice(0, 4).map((text, index) => ({
      text,
      detail:
        index === 0
          ? `Notes: ${dashboard?.summary?.notes ?? 0} · Documents: ${dashboard?.summary?.documents ?? 0}`
          : `Memories: ${dashboard?.summary?.memories ?? 0} · Conversations: ${dashboard?.summary?.conversations ?? 0}`,
      color: insightColors[index % insightColors.length],
    }));
  }, [dashboard]);

  const timeline = useMemo(() => dashboard?.recentActivity ?? [], [dashboard]);

  const navigateTo = (view: string) => {
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: view }));
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 space-y-16">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative"
      >
        <div className="orb-glow">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-xs font-medium text-primary">
                {loading ? "Syncing data" : "AI Memory Active"}
              </span>
            </motion.div>

            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] text-foreground">
              Your AI memory
              <br />
              <span className="text-gradient-primary">is evolving.</span>
            </h1>

            <p className="mt-5 text-base text-muted-foreground max-w-lg leading-relaxed">
              {`PDOS is connected to ${dashboard?.summary?.notes ?? 0} notes, ${dashboard?.summary?.documents ?? 0} documents, and ${dashboard?.summary?.conversations ?? 0} conversations.`}
            </p>

            <div className="mt-8 flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigateTo("chat")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold glow-primary transition-shadow hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
              >
                <Sparkles className="w-4 h-4" />
                Ask your data
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigateTo("insights")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 text-secondary-foreground text-sm font-medium border border-glass-border/30 hover:border-glass-border/50 transition-colors"
              >
                View insights
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Smart Insights */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Smart Insights</h2>
        </div>

        <div className="space-y-3">
          {smartInsights.map((insight, i) => {
            const colors = accentColors[insight.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                className={`group glass-card-hover p-5 cursor-pointer`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${colors.dot} ${colors.glow} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">{insight.text}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">{insight.detail}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Activity Timeline */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Recent Activity</h2>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-surface-3 via-surface-3 to-transparent" />

          <div className="space-y-1">
            {timeline.map((item, i) => {
              const colors = accentColors[item.accent as keyof typeof accentColors] ?? accentColors.primary;
              const ItemIcon = activityIcons[item.type] || Brain;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.35 }}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-1 transition-colors duration-200 cursor-pointer group relative"
                >
                  <div className={`w-[38px] h-[38px] rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0 relative z-10 group-hover:scale-105 transition-transform duration-200`}>
                    <ItemIcon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/70 shrink-0">{item.time}</span>
                </motion.div>
              );
            })}

            {!timeline.length && !loading && (
              <p className="text-xs text-muted-foreground px-2 py-3">
                No recent activity yet. Create notes, upload documents, or start a chat.
              </p>
            )}
          </div>
        </div>
      </motion.section>
    </div>
    </div>
  );
};

export default DashboardView;
