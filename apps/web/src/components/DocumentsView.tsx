import { useState, useEffect } from 'react';
import { getDocuments, getUploadUrl, processDocument } from '../lib/api';
import type { Document } from '../lib/api';

interface DocumentsViewProps {
  companyId: string;
}

export function DocumentsView({ companyId }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ documentId: string; extracted: unknown; rawText: string } | null>(null);

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
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { uploadUrl, document: doc } = await getUploadUrl(
        file.name,
        file.type,
        companyId
      );

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setDocuments((prev) => [doc, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleProcess(docId: string, docType: string) {
    setProcessing(docId);
    setOcrResult(null);
    try {
      const result = await processDocument(docId, docType);
      setOcrResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <div className="text-gray-500 py-8 text-center">იტვირთება...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">დოკუმენტები</h2>
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          {uploading ? 'იტვირთება...' : 'ატვირთვა'}
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-gray-400 text-lg mb-2">დოკუმენტები არ არის</div>
          <p className="text-gray-400 text-sm">
            ატვირთეთ ჩეკი, ინვოისი ან საბანკო ამონაწერი OCR დასამუშავებლად
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString('ka-GE')}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-3">{doc.mimeType}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleProcess(doc.id, 'receipt')}
                    disabled={processing === doc.id}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {processing === doc.id ? 'მუშავდება...' : 'ჩეკი'}
                  </button>
                  <button
                    onClick={() => handleProcess(doc.id, 'invoice')}
                    disabled={processing === doc.id}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    ინვოისი
                  </button>
                  <button
                    onClick={() => handleProcess(doc.id, 'bank_statement')}
                    disabled={processing === doc.id}
                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                  >
                    ამონაწერი
                  </button>
                </div>
              </div>
            ))}
          </div>

          {ocrResult && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">OCR შედეგი</h3>
              {ocrResult.extracted ? (
                <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-96">
                  {JSON.stringify(ocrResult.extracted, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-gray-500">
                  <p className="mb-2">ვერ მოხერხდა JSON-ის ამოღება. სრული პასუხი:</p>
                  <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                    {ocrResult.rawText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
