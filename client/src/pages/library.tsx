import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, Search, BookOpen, Trash2, Eye, EyeOff, FileText, FileSpreadsheet, Plus, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";
import type { Vocabulary } from "@shared/schema";

interface UploadResult {
  added: number;
  merged: number;
  skipped: number;
  total: number;
  skippedWords: string[];
}

interface AddRow {
  simplified: string;
  pinyin: string;
  english: string;
  source: string;
  lessonNumber: string;
  exampleSentence: string;
}

const emptyAddRow = (): AddRow => ({
  simplified: "",
  pinyin: "",
  english: "",
  source: "",
  lessonNumber: "",
  exampleSentence: "",
});

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedLesson, setSelectedLesson] = useState<string>("all");
  const [uploadPreview, setUploadPreview] = useState<any[] | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [addRows, setAddRows] = useState<AddRow[]>([emptyAddRow()]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: words, isLoading } = useQuery<Vocabulary[]>({
    queryKey: ["/api/vocabulary"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/vocabulary/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith("/api/review/stats") });
      const parts = [`Added ${data.added} new words`];
      if (data.merged > 0) parts.push(`${data.merged} merged with existing`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      toast({
        title: "Import Complete",
        description: parts.join(". ") + ".",
      });
      setUploadPreview(null);
      setUploadFile(null);
    },
    onError: (err) => {
      toast({
        title: "Import Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const addWordsMutation = useMutation({
    mutationFn: async (rows: AddRow[]) => {
      const words = rows
        .map((r) => ({
          simplified: r.simplified.trim(),
          pinyin: r.pinyin.trim(),
          english: r.english.trim(),
          source: r.source.trim() || undefined,
          lessonNumber: r.lessonNumber.trim() ? parseInt(r.lessonNumber, 10) : undefined,
          exampleSentence: r.exampleSentence.trim() || undefined,
        }))
        .filter((r) => r.simplified && r.pinyin && r.english);
      if (words.length === 0) throw new Error("At least one word must have Simplified, Pinyin, and English.");
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ words }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const j = JSON.parse(text);
          if (j?.message) msg = j.message;
        } catch {}
        throw new Error(msg);
      }
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith("/api/review/stats") });
      const parts = [`Added ${data.added} new words`];
      if (data.merged > 0) parts.push(`${data.merged} merged with existing`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      toast({
        title: "Add Complete",
        description: parts.join(". ") + ".",
      });
      setAddRows([emptyAddRow()]);
    },
    onError: (err) => {
      toast({
        title: "Add Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vocabulary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith("/api/review/stats") });
    },
  });

  const buryMutation = useMutation({
    mutationFn: async ({ id, buried }: { id: number; buried: boolean }) => {
      await apiRequest("PATCH", `/api/vocabulary/${id}`, { buried });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith("/api/review/stats") });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const allRows = rawRows.map((row) => row.map((cell: any) => String(cell).trim()));
        const isHeader = /simplified|chinese|hanzi|pinyin/i.test(allRows[0]?.join(" ") || "");
        const dataRows = isHeader ? allRows.slice(1) : allRows;
        const rows = dataRows.slice(0, 10).map((parts) => ({
          simplified: parts[0] || "",
          pinyin: parts[1] || "",
          english: parts[2] || "",
          source: parts[3] || "",
          lessonNumber: parts[4] || "",
        }));
        setUploadPreview(rows);
        setUploadFile(file);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        const separator = lines[0]?.includes("\t") ? "\t" : ",";
        const isHeader = /simplified|chinese|hanzi|pinyin/i.test(lines[0] || "");
        const dataLines = isHeader ? lines.slice(1) : lines;
        const rows = dataLines.slice(0, 10).map((line) => {
          const parts = line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ""));
          return {
            simplified: parts[0]?.replace(/^\ufeff/, "") || "",
            pinyin: parts[1] || "",
            english: parts[2] || "",
            source: parts[3] || "",
            lessonNumber: parts[4] || "",
          };
        });
        setUploadPreview(rows);
        setUploadFile(file);
      };
      reader.readAsText(file);
    }
  };

  const sources = Array.from(new Set(words?.flatMap(w => w.source || []))).sort();
  const lessons = Array.from(new Set(
    words?.filter(w => {
      if (selectedSource === "all") return true;
      return (w.source || []).includes(selectedSource);
    }).flatMap(w => {
      if (selectedSource === "all") return (w.lessonNumber || []).filter(Boolean);
      const idx = (w.source || []).indexOf(selectedSource);
      if (idx >= 0) {
        const ln = (w.lessonNumber || [])[idx];
        return ln ? [ln] : [];
      }
      return [];
    })
  )).sort((a, b) => a - b);

  const normalizePinyin = (p: string) => {
    return p
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  };

  const filteredWords = words?.filter((w) => {
    const wSources = w.source || [];
    const wLessons = w.lessonNumber || [];
    if (selectedSource !== "all" && !wSources.includes(selectedSource)) return false;
    if (selectedLesson !== "all") {
      const lessonNum = parseInt(selectedLesson);
      if (selectedSource !== "all") {
        const idx = wSources.indexOf(selectedSource);
        if (idx < 0 || wLessons[idx] !== lessonNum) return false;
      } else {
        if (!wLessons.includes(lessonNum)) return false;
      }
    }
    if (!searchQuery) return true;
    
    const q = normalizePinyin(searchQuery);
    const simplified = w.simplified.toLowerCase();
    const pinyin = normalizePinyin(w.pinyin);
    const english = w.english.toLowerCase();

    return (
      simplified.includes(q) ||
      pinyin.includes(q) ||
      english.includes(q) ||
      // Also check original query for non-pinyin cases
      w.simplified.includes(searchQuery.toLowerCase()) ||
      w.english.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="mb-4">
        <h1 className="relative flex items-baseline gap-2 text-2xl sm:text-4xl font-serif font-bold tracking-tight" data-testid="text-library-title">
          <span>Vocabulary Library</span>
          <div className="h-6 w-[2px] bg-primary rotate-12 mx-1 self-center" />
          <span>词汇表</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {words ? `${words.length} words in your corpus` : "Loading..."}
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <BookOpen className="w-4 h-4 mr-1" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="w-4 h-4 mr-1" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="add" data-testid="tab-add">
            <PlusCircle className="w-4 h-4 mr-1" />
            Add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
            This library feeds your flashcard review system and your news feed rankings. 
            Add words you know or are learning to improve your experience.
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-vocab"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <select 
                value={selectedSource}
                onChange={(e) => { setSelectedSource(e.target.value); setSelectedLesson("all"); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">All Sources</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select 
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                disabled={selectedSource === "all"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">All Lessons</option>
                {lessons.map(l => <option key={l} value={l.toString()}>L{l}</option>)}
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {filteredWords && filteredWords.length === 0 && (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground">
                {words?.length === 0 ? "No vocabulary loaded. Upload a file to get started." : "No results found."}
              </p>
            </Card>
          )}

          {filteredWords && filteredWords.length > 0 && (
            <div className="h-[calc(100vh-320px)] overflow-y-auto">
              <div className="space-y-1">
                {filteredWords.map((word) => (
                  <Card
                    key={word.id}
                    className={`p-3 ${word.buried ? "opacity-50" : ""}`}
                    data-testid={`card-vocab-${word.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl font-serif font-bold">{word.simplified}</span>
                          <span className="text-sm text-muted-foreground">{word.pinyin}</span>
                          {word.source && word.source.map((s, i) => (
                            <span key={s} className="inline-flex items-center gap-0.5">
                              <Badge variant="outline" className="text-xs">{s}</Badge>
                              {(word.lessonNumber || [])[i] != null && (
                                <Badge variant="secondary" className="text-xs">L{(word.lessonNumber || [])[i]}</Badge>
                              )}
                            </span>
                          ))}
                          {word.buried && (
                            <Badge variant="outline" className="text-xs">Buried</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{word.english}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            buryMutation.mutate({ id: word.id, buried: !word.buried });
                          }}
                          data-testid={`button-bury-${word.id}`}
                        >
                          {word.buried ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(word.id);
                          }}
                          data-testid={`button-delete-${word.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
            Add 1–10 words at a time. Source and Lesson number are optional (e.g. for words you picked up in daily life). Use the number system for pinyin (e.g. ni3 hao3).
          </div>
          <Card className="p-4 space-y-4">
            <div className="space-y-3">
              {addRows.map((row, index) => (
                <div key={index} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 items-end">
                    <Input
                      placeholder="Simplified"
                      value={row.simplified}
                      onChange={(e) => {
                        const next = [...addRows];
                        next[index] = { ...next[index], simplified: e.target.value };
                        setAddRows(next);
                      }}
                      className="font-serif"
                      data-testid={`add-simplified-${index}`}
                    />
                    <Input
                      placeholder="Pinyin (e.g. ni3 hao3)"
                      value={row.pinyin}
                      onChange={(e) => {
                        const next = [...addRows];
                        next[index] = { ...next[index], pinyin: e.target.value };
                        setAddRows(next);
                      }}
                      data-testid={`add-pinyin-${index}`}
                    />
                    <Input
                      placeholder="English"
                      value={row.english}
                      onChange={(e) => {
                        const next = [...addRows];
                        next[index] = { ...next[index], english: e.target.value };
                        setAddRows(next);
                      }}
                      data-testid={`add-english-${index}`}
                    />
                    <Input
                      placeholder="Source (optional)"
                      value={row.source}
                      onChange={(e) => {
                        const next = [...addRows];
                        next[index] = { ...next[index], source: e.target.value };
                        setAddRows(next);
                      }}
                      data-testid={`add-source-${index}`}
                    />
                    <Input
                      placeholder="Lesson # (optional)"
                      type="text"
                      inputMode="numeric"
                      value={row.lessonNumber}
                      onChange={(e) => {
                        const next = [...addRows];
                        next[index] = { ...next[index], lessonNumber: e.target.value };
                        setAddRows(next);
                      }}
                      data-testid={`add-lesson-${index}`}
                    />
                    <div className="flex items-center gap-1">
                      {addRows.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setAddRows((prev) => prev.filter((_, i) => i !== index))}
                          data-testid={`add-remove-row-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Example sentence (optional)"
                    value={row.exampleSentence}
                    onChange={(e) => {
                      const next = [...addRows];
                      next[index] = { ...next[index], exampleSentence: e.target.value };
                      setAddRows(next);
                    }}
                    className="text-sm"
                    data-testid={`add-example-${index}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {addRows.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddRows((prev) => [...prev, emptyAddRow()])}
                  data-testid="button-add-row"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add row
                </Button>
              )}
              <Button
                type="button"
                onClick={() => addWordsMutation.mutate(addRows)}
                disabled={addWordsMutation.isPending || !addRows.some((r) => r.simplified.trim() && r.pinyin.trim() && r.english.trim())}
                data-testid="button-submit-add"
              >
                {addWordsMutation.isPending ? "Adding..." : "Add words"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card className="p-6 border-dashed text-center space-y-4">
            <div className="space-y-2">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
              <h3 className="font-semibold">Upload Vocabulary File</h3>
              <p className="text-sm text-muted-foreground">
                Excel (.xlsx) or CSV/TSV with columns: <strong>Simplified, Pinyin, English, Source, Lesson Number</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Example: 你好 [tab] nǐ hǎo [tab] Hello [tab] NPCR 1 [tab] 1
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-upload"
            />
            <Button onClick={() => fileInputRef.current?.click()} data-testid="button-choose-file">
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
          </Card>

          {uploadPreview && (
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">Preview (first 10 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Chinese</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Pinyin</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">English</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Source</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">L#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-serif text-lg">{row.simplified}</td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs">{row.pinyin}</td>
                        <td className="py-2 pr-4 text-xs">{row.english}</td>
                        <td className="py-2 pr-4 text-xs">{row.source}</td>
                        <td className="py-2 text-xs">{row.lessonNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => uploadFile && uploadMutation.mutate(uploadFile)}
                  disabled={uploadMutation.isPending}
                  data-testid="button-confirm-upload"
                >
                  {uploadMutation.isPending ? "Importing..." : "Import All"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setUploadPreview(null); setUploadFile(null); }}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
