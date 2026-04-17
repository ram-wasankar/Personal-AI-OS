import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Clock, MoreHorizontal, StickyNote, Save } from "lucide-react";

import { createNote, deleteNote, getNotes, updateNote, type ApiNote } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

const NotesView = () => {
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  useEffect(() => {
    const loadNotes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getNotes();
        setNotes(data);
        if (data.length) {
          setSelectedNoteId(data[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load notes");
      } finally {
        setIsLoading(false);
      }
    };

    void loadNotes();
  }, []);

  useEffect(() => {
    if (!selectedNote) {
      setTitleDraft("");
      setContentDraft("");
      setHasUnsavedChanges(false);
      return;
    }

    setTitleDraft(selectedNote.title);
    setContentDraft(selectedNote.content);
    setHasUnsavedChanges(false);
  }, [selectedNote]);

  const handleSave = useCallback(async () => {
    if (!selectedNote) {
      return;
    }

    const nextTitle = titleDraft.trim();
    const nextContent = contentDraft.trim();

    if (!nextTitle || !nextContent) {
      return;
    }

    if (nextTitle === selectedNote.title && nextContent === selectedNote.content) {
      setHasUnsavedChanges(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const updated = await updateNote(selectedNote.id, { title: nextTitle, content: nextContent });
      setNotes((prev) => prev.map((note) => (note.id === updated.id ? updated : note)));
      setHasUnsavedChanges(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }, [selectedNote, titleDraft, contentDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleSave]);

  const handleCreateNote = async () => {
    try {
      setError(null);
      const created = await createNote("Untitled note", "Start writing...");
      setNotes((prev) => [created, ...prev]);
      setSelectedNoteId(created.id);
      setHasUnsavedChanges(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create note");
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) {
      return;
    }

    try {
      setError(null);
      await deleteNote(selectedNote.id);
      setNotes((prev) => {
        const remaining = prev.filter((note) => note.id !== selectedNote.id);
        setSelectedNoteId(remaining[0]?.id ?? null);
        return remaining;
      });
      setHasUnsavedChanges(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete note");
    }
  };

  const filtered = notes.filter(
    (n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="h-full flex">
      <div className="w-72 lg:w-80 border-r border-border/50 flex flex-col shrink-0 bg-surface-0">
        <div className="h-13 flex items-center justify-between px-4 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleCreateNote}
            className="w-7 h-7 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1 border border-glass-border/20 focus-within:border-primary/20 transition-colors">
            <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none flex-1"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5 pb-4">
          {error && <p className="px-2 py-1.5 text-[11px] text-destructive">{error}</p>}

          {isLoading && <p className="px-2 py-2 text-[11px] text-muted-foreground">Loading notes...</p>}

          {filtered.map((note) => {
            const isActive = selectedNoteId === note.id;
            return (
              <motion.button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 relative ${
                  isActive ? "bg-primary/8" : "hover:bg-surface-1"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="note-active"
                    className="absolute inset-0 rounded-xl bg-primary/8 border border-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10">
                  <p className={`text-[13px] font-medium truncate ${isActive ? "text-foreground" : "text-secondary-foreground"}`}>
                    {note.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(note.createdAt)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-muted-foreground/60">Note</span>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {!isLoading && !filtered.length && (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No matching notes</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="h-13 flex items-center justify-between px-6 shrink-0 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-1 rounded-lg bg-surface-2 text-muted-foreground font-medium">
                  {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
                </span>
                {isSaving && <span className="text-[10px] text-primary">Saving...</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={!hasUnsavedChanges || isSaving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-8 lg:p-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedNote.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-xl mx-auto"
                >
                  <input
                    value={titleDraft}
                    onChange={(event) => {
                      setTitleDraft(event.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onBlur={() => {
                      void handleSave();
                    }}
                    className="w-full text-2xl lg:text-3xl font-bold text-foreground bg-transparent outline-none mb-6 placeholder:text-muted-foreground/30 tracking-tight"
                    placeholder="Untitled"
                  />
                  <textarea
                    value={contentDraft}
                    onChange={(event) => {
                      setContentDraft(event.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onBlur={() => {
                      void handleSave();
                    }}
                    className="w-full text-[14.5px] text-foreground/80 bg-transparent outline-none resize-none leading-[1.8] min-h-[60vh] placeholder:text-muted-foreground/30"
                    placeholder="Start writing..."
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                <StickyNote className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Select a note to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesView;
