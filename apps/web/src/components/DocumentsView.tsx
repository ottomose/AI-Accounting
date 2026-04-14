import { useState, useEffect } from 'react';
import { getDocuments, uploadDocument, processDocument, getDocumentDownloadUrl, deleteDocument } from '../lib/api';
import type { Document } from '../lib/api';

interface DocumentsViewProps {
  companyId: string;
}

const FILE_ACCEPT = 'image/*,.pdf,.xlsx,.xls,.csv,.xml,.txt';

const EXTENSION_MIME: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function guessMimeFromName(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return EXTENSION_MIME[ext] || 'application/octet-stream';
}

const FILE_ICONS: Record<string, string> = {
  'image/': '🖼️',
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-excel': '📊',
  'text/csv': '📊',
  'application/csv': '📊',
  'text/xml': '📋',
  'application/xml': '📋',
  'text/plain': '📝',
};

function getFileIcon(mime: string): string {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mime.startsWith(key) || mime === key) return icon;
  }
  return '📎';
}

function getFileTypeLabel(mime: string): string {
  if (mime.startsWith('image/')) return 'სურათი';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Excel';
  if (mime === 'text/csv' || mime === 'application/csv') return 'CSV';
  if (mime.includes('xml')) return 'XML';
  if (mime === 'text/plain') return 'ტექსტი';
  return mime;
}

function guessDocumentType(fileName: string, mime: string): string {
  const name = fileName.toLowerCase();
  if (name.includes('invoice') || name.includes('ინვოის') || name.includes('ზედნადებ')) return 'invoice';
  if (name.includes('statement') || name.includes('ამონაწერ') || name.includes('ექსტრაქტ')) return 'bank_statement';
  if (mime === 'text/csv' || mime.includes('spreadsheet') || mime.includes('excel')) return 'bank_statement';
  return 'receipt';
}

export function DocumentsView({ companyId }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    documentId: string;
    extracted: unknown;
    rawText: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [companyId]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const data = await getDocuments(companyId);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(file, companyId);
        setDocuments((prev) => [doc, ...prev]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ატვირთვა ვერ მოხერხდა';
      setError(msg);
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleProcess(docId: string, docType: string) {
    setProcessing(docId);
    setOcrResult(null);
    setError('');
    try {
      const result = await processDocument(docId, docType);
      setOcrResult(result);
    } catch (err) {
      setError('დამუშავება ვერ მოხერხდა');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  }

  async function handleView(docId: string) {
    setViewing(docId);
    setError('');
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(docId);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError('ფაილის გახსნა ვერ მოხერხდა');
      console.error(err);
    } finally {
      setViewing(null);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('ნამდვილად გსურთ ამ დოკუმენტის წაშლა?')) return;
    setDeleting(docId);
    setError('');
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (ocrResult?.documentId === docId) setOcrResult(null);
    } catch (err) {
      setError('წაშლა ვერ მოხერხდა');
      console.error(err);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <div className="text-gray-500 py-8 text-center">იტვირთება...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">დოკუმენტები</h2>
          <p className="text-sm text-gray-400 mt-1">
            PDF, სურათი, Excel, CSV, XML, TXT
          </p>
        </div>
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          {uploading ? 'იტვირთება...' : 'ატვირთვა'}
          <input
            type="file"
            accept={FILE_ACCEPT}
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
            multiple
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-4xl mb-3">📁</div>
          <div className="text-gray-400 text-lg mb-2">დოკუმენტები არ არის</div>
          <p className="text-gray-400 text-sm">
            ატვირთეთ ჩეკი, ინვოისი, საბანკო ამონაწერი ან სხვა ფინანსური დოკუმენტი
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-2">{documents.length} დოკუმენტი</div>
            {documents.map((doc) => {
              const suggestedType = guessDocumentType(doc.fileName, doc.mimeType);
              return (
                <div key={doc.id} className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getFileIcon(doc.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {doc.fileName}
                        </div>
                        <div className="text-xs text-gray-400 ml-2 shrink-0">
                          {new Date(doc.createdAt).toLocaleDateString('ka-GE')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-400">
                          {getFileTypeLabel(doc.mimeType)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(doc.id)}
                            disabled={viewing === doc.id}
                            className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            {viewing === doc.id ? '...' : 'ნახვა'}
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            {deleting === doc.id ? '...' : 'წაშლა'}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">დამუშავება:</span>
                        {['receipt', 'invoice', 'bank_statement', 'general'].map((type) => {
                          const labels: Record<string, string> = {
                            receipt: 'ჩეკი',
                            invoice: 'ინვოისი',
                            bank_statement: 'ამონაწერი',
                            general: 'ზოგადი',
                          };
                          const colors: Record<string, string> = {
                            receipt: 'bg-green-50 text-green-600 hover:bg-green-100',
                            invoice: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                            bank_statement: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
                            general: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
                          };
                          return (
                            <button
                              key={type}
                              onClick={() => handleProcess(doc.id, type)}
                              disabled={processing === doc.id}
                              className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${colors[type]} ${
                                suggestedType === type ? 'ring-2 ring-offset-1 ring-blue-300' : ''
                              }`}
                            >
                              {processing === doc.id ? '...' : labels[type]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            {ocrResult ? (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">დამუშავების შედეგი</h3>
                  <button
                    onClick={() => setOcrResult(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    დახურვა
                  </button>
                </div>

                {ocrResult.extracted ? (
                  <div>
                    <div className="text-xs text-green-600 mb-2">JSON წარმატებით ამოიღო</div>
                    <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-[60vh]">
                      {JSON.stringify(ocrResult.extracted, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-yellow-600 mb-2">
                      JSON ვერ ამოიღო — ნახეთ სრული პასუხი
                    </div>
                    <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap">
                      {ocrResult.rawText}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                <div className="text-gray-300 text-4xl mb-3">🔍</div>
                <p className="text-gray-400 text-sm">
                  აირჩიეთ დოკუმენტი და დააჭირეთ დამუშავების ტიპს
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
