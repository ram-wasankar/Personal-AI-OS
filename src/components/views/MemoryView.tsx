import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Lightbulb, Star, Clock, Zap, TrendingUp, Link2 } from "lucide-react";

import { getMemory, type ApiMemory } from "@/lib/api";
import { formatRelativeTime, inferConnections } from "@/lib/format";

const typeStyles = {
  interest: {
    gradient: "from-primary/10 to-primary/5",
    border: "border-primary/15 hover:border-primary/25",
    glow: "group-hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.15)]",
    badge: "bg-primary/10 text-primary",
  },
  habit: {
    gradient: "from-warning/10 to-warning/5",
    border: "border-warning/15 hover:border-warning/25",
    glow: "group-hover:shadow-[0_0_24px_-6px_hsl(var(--warning)/0.15)]",
    badge: "bg-warning/10 text-warning",
  },
  preference: {
    gradient: "from-accent/10 to-accent/5",
    border: "border-accent/15 hover:border-accent/25",
    glow: "group-hover:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.15)]",
    badge: "bg-accent/10 text-accent",
  },
  knowledge: {
    gradient: "from-success/10 to-success/5",
    border: "border-success/15 hover:border-success/25",
    glow: "group-hover:shadow-[0_0_24px_-6px_hsl(var(--success)/0.15)]",
    badge: "bg-success/10 text-success",
  },
};

const iconMap = {
  interest: Lightbulb,
  habit: Clock,
  preference: Star,
  knowledge: Zap,
} as const;

const MemoryView = () => {
  const [memories, setMemories] = useState<ApiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getMemory();
        setMemories(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load memory");
      } finally {
        setLoading(false);
      }
    };

    void loadMemories();
  }, []);

  const confidence = useMemo(() => {
    if (!memories.length) {
      return 0;
    }
    const avg = memories.reduce((sum, item) => sum + item.importanceScore, 0) / memories.length;
    return Math.round(avg * 100);
  }, [memories]);

  const uniqueConnections = useMemo(() => {
    const tokens = memories.flatMap((item) => inferConnections(item.content));
    return new Set(tokens).size;
  }, [memories]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center animate-breathe">
            <Brain className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Memory</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          Your AI builds a persistent memory of who you are — your interests, habits, preferences, and expertise — getting smarter over time.
        </p>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex items-center gap-6 px-5 py-4 rounded-2xl bg-surface-1 border border-glass-border/15"
      >
        {[
          { label: "Memories", value: memories.length.toString() },
          { label: "Confidence", value: `${confidence}%` },
          { label: "Connections", value: uniqueConnections.toString() },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            {i > 0 && <div className="w-px h-8 bg-surface-3" />}
            <div className={i > 0 ? "pl-3" : ""}>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Memory cards */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="px-1 text-xs text-muted-foreground">Loading memories...</p>}

        {memories.map((m, i) => {
          const style = typeStyles[m.memoryType] ?? typeStyles.knowledge;
          const MemoryIcon = iconMap[m.memoryType] ?? TrendingUp;
          const connections = inferConnections(m.content);
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
              className={`group rounded-2xl bg-gradient-to-r ${style.gradient} border ${style.border} ${style.glow} p-5 cursor-pointer transition-all duration-300`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-1/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <MemoryIcon className="w-4.5 h-4.5 text-foreground/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider ${style.badge}`}>
                      {m.memoryType}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">{formatRelativeTime(m.lastAccessed)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{m.content}</p>

                  {/* Confidence bar */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-24 h-1 rounded-full bg-surface-3/80 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(m.importanceScore * 100)}%` }}
                        transition={{ delay: 0.4 + i * 0.06, duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-foreground/20"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{Math.round(m.importanceScore * 100)}%</span>
                  </div>

                  {/* Connections */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <Link2 className="w-3 h-3 text-muted-foreground/40" />
                    {connections.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-surface-2/60 text-muted-foreground/70 hover:text-foreground hover:bg-surface-3 cursor-pointer transition-colors"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {!loading && !memories.length && (
          <p className="px-1 text-xs text-muted-foreground">
            No long-term memories extracted yet. Start chatting to build memory.
          </p>
        )}
      </div>
    </div>
    </div>
  );
};

export default MemoryView;
