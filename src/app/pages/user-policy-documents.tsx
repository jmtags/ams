import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText, Search } from "lucide-react";
import { UserLayout } from "../layouts/user-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  policyDocumentService,
  type PolicyDocument,
} from "../services/policy-document.service";

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
};

export function UserPolicyDocumentsPage() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<PolicyDocument | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        setError("");
        setDocuments(await policyDocumentService.getPublished());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load Corporate HR policies and documents."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) =>
      [
        document.title,
        document.description ?? "",
        document.category ?? "",
        document.file_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [documents, search]);

  return (
    <UserLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-neutral-900 mb-1">
            Company Policies and Documents
          </h1>
          <p className="text-neutral-600">
            Read the latest policies and documents published by Corporate HR.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Policies and Documents Library
                </CardTitle>
                <CardDescription>
                  Select a document to read it without leaving the portal.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search policies and documents..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-neutral-500">
                Loading policy documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-600">
                  {search
                    ? "No policies or documents match your search."
                    : "No policies or documents are currently available."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDocuments.map((document) => (
                  <button
                    type="button"
                    key={document.id}
                    onClick={() => setSelectedDocument(document)}
                    className="text-left rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <Badge variant="secondary">
                        {document.category || "General"}
                      </Badge>
                    </div>
                    <h2 className="font-medium text-neutral-900 mb-2">
                      {document.title}
                    </h2>
                    <p className="text-sm text-neutral-600 line-clamp-3 min-h-[3.75rem]">
                      {document.description || "Corporate HR policy document"}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-500">
                      <span>{formatFileSize(document.file_size) || "PDF"}</span>
                      <span>
                        Updated{" "}
                        {new Date(document.updated_at).toLocaleDateString("en-PH")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedDocument)}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
      >
        <DialogContent
          onClose={() => setSelectedDocument(null)}
          className="w-[96vw] max-w-6xl h-[92vh] p-0 overflow-hidden flex flex-col"
        >
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.description ||
                selectedDocument?.file_name ||
                "Corporate HR policy document"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-0 flex-1 min-h-0 bg-neutral-100">
            {selectedDocument && (
              <iframe
                src={`${selectedDocument.file_url}#toolbar=1&navpanes=0`}
                title={selectedDocument.title}
                className="w-full h-full border-0"
              />
            )}
          </DialogBody>
          <DialogFooter className="px-5 py-3 border-t shrink-0">
            {selectedDocument && (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    selectedDocument.file_url,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            )}
            <Button onClick={() => setSelectedDocument(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
