import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, BookOpen, Target, Lightbulb, ArrowRight } from "lucide-react";

import { getDashboard, type ApiDashboard } from "@/lib/api";

const insightTypeStyles = {
  trend: "border-primary/15 hover:border-primary/25",
  connection: "border-accent/15 hover:border-accent/25",
  gap: "border-warning/15 hover:border-warning/25",
};

const insightTypeCycle = ["trend", "connection", "gap"] as const;
const topicBarColors = ["from-primary to-accent", "from-accent to-primary", "from-warning to-primary", "from-success to-primary"];

const InsightsView = () => {
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getDashboard();
        setDashboard(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load insights");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const insights = useMemo(() => {
    const base = dashboard?.insights?.length
      ? dashboard.insights
      : ["Add notes and documents to generate insights."];

    return base.slice(0, 4).map((item, index) => ({
      icon: index % 2 === 0 ? TrendingUp : Lightbulb,
      title: item,
      detail: `Derived from ${dashboard?.summary?.notes ?? 0} notes, ${dashboard?.summary?.documents ?? 0} documents, and ${dashboard?.summary?.memories ?? 0} memory entries.`,
      type: insightTypeCycle[index % insightTypeCycle.length],
    }));
  }, [dashboard]);

  const topicClusters = useMemo(() => {
    const topics = dashboard?.topicDistribution ?? [];
    return topics.map((topic, index) => ({
      ...topic,
      color: topicBarColors[index % topicBarColors.length],
    }));
  }, [dashboard]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Insights</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          AI-generated analysis of your knowledge — patterns, connections, and gaps you might have missed.
        </p>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && <p className="text-xs text-muted-foreground">Loading insights...</p>}

      {/* Insights cards */}
      <section className="space-y-3">
        {insights.map((ins, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            className={`group glass-card p-6 border cursor-pointer transition-all duration-300 hover:translate-y-[-1px] ${insightTypeStyles[ins.type as keyof typeof insightTypeStyles]}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                <ins.icon className="w-4.5 h-4.5 text-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug">{ins.title}</p>
                <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{ins.detail}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
            </div>
          </motion.div>
        ))}
      </section>

      {/* Topic clusters + activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Topics */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Topic Distribution</h2>
          </div>
          <div className="space-y-5">
            {topicClusters.map((topic, i) => (
              <div key={topic.name}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[13px] text-foreground font-medium">{topic.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{topic.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${topic.pct}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${topic.color} opacity-60`}
                  />
                </div>
              </div>
            ))}

            {!topicClusters.length && !loading && (
              <p className="text-xs text-muted-foreground">Topic distribution will appear as your content grows.</p>
            )}
          </div>
        </motion.section>

        {/* Knowledge growth */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-4 h-4 text-success" />
            <h2 className="text-sm font-semibold text-foreground">Knowledge Growth</h2>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => {
              const intensity = Math.sin(i * 0.3 + 1) * 0.5 + 0.5;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.015, duration: 0.2 }}
                  className="aspect-square rounded"
                  style={{
                    backgroundColor: intensity > 0.7
                      ? `hsl(217 92% 62% / ${intensity * 0.5})`
                      : intensity > 0.3
                      ? `hsl(270 80% 65% / ${intensity * 0.3})`
                      : `hsl(228 14% 14%)`,
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-3 text-[10px] text-muted-foreground/50">
            <span>5 weeks ago</span>
            <span>This week</span>
          </div>
          <div className="mt-5 p-4 rounded-xl bg-surface-1 border border-glass-border/10">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">Peak activity: </span>
              {`Memory confidence is ${Math.round(dashboard?.memoryConfidence ?? 0)}%. Keep chatting and indexing documents to improve precision.`}
            </p>
          </div>
        </motion.section>
      </div>
    </div>
    </div>
  );
};

export default InsightsView;
