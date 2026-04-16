import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Search, MoreHorizontal, CheckCircle2, Loader2, Clock } from "lucide-react";

import { getDocuments, uploadDocument, type ApiDocument } from "@/lib/api";
import { formatFileSize, formatRelativeTime } from "@/lib/format";

const statusConfig = {
  uploading: { icon: Upload, label: "Uploading", className: "text-muted-foreground" },
  indexed: { icon: CheckCircle2, label: "Indexed", className: "text-success" },
  ready: { icon: CheckCircle2, label: "Ready", className: "text-success" },
  processing: { icon: Loader2, label: "Processing", className: "text-warning animate-spin" },
  pending: { icon: Clock, label: "Pending", className: "text-muted-foreground" },
  failed: { icon: Clock, label: "Failed", className: "text-destructive" },
};

const DocumentsView = () => {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [search, setSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const payload = await getDocuments();
        setDocuments(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load documents");
      } finally {
        setIsLoading(false);
      }
    };

    void loadDocuments();
  }, []);

  const filtered = documents.filter((d) => d.fileName.toLowerCase().includes(search.toLowerCase()));

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      const uploaded = await uploadDocument(file);
      setDocuments((prev) => [uploaded, ...prev]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await handleUpload(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    await handleUpload(file);
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 space-y-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-2">Upload files and they'll be chunked, embedded, and searchable by AI.</p>
        </motion.div>

        {/* Upload */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => { void handleDrop(event); }}
          className={`relative rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
            isDragOver
              ? "bg-primary/5 border-2 border-primary/30"
              : "bg-surface-1/50 border-2 border-dashed border-glass-border/20 hover:border-glass-border/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md"
            onChange={(event) => { void handleFileInputChange(event); }}
          />
          <div className={`w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${
            isDragOver ? "bg-primary/15 scale-110" : "bg-surface-2 group-hover:bg-surface-3"
          }`}>
            <Upload className={`w-5 h-5 transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {isUploading ? "Uploading and indexing..." : "PDF, TXT, MD — automatically chunked and indexed"}
          </p>
        </motion.div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-1 border border-glass-border/15 focus-within:border-primary/20 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none flex-1"
          />
        </div>

        {/* Documents */}
        <div className="space-y-2">
          {isLoading && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading documents...</p>
          )}

          {filtered.map((doc, i) => {
            const status = statusConfig[doc.status] ?? statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
                className="glass-card-hover p-4 flex items-center gap-4 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors duration-200">
                  <FileText className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-muted-foreground/60">{formatFileSize(doc.sizeBytes)}</span>
                    <span className="text-[11px] text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground/60">{formatRelativeTime(doc.createdAt)}</span>
                    {doc.chunks > 0 && (
                      <>
                        <span className="text-[11px] text-muted-foreground/40">·</span>
                        <span className="text-[11px] text-muted-foreground/60">{doc.chunks} chunks</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={`w-3.5 h-3.5 ${status.className}`} />
                    <span className={`text-[11px] font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <button className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}

          {!isLoading && !filtered.length && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No documents yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsView;
