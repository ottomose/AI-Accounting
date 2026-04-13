import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { getSignedUploadUrl, getSignedDownloadUrl, deleteFile } from '../storage/r2';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { processDocumentOCR } from '../ai/service';

const documentsRoute = new Hono();

// Get presigned upload URL
documentsRoute.post('/upload-url', authMiddleware, async (c) => {
  const { fileName, contentType, companyId } = await c.req.json();
  const { user } = c.get('authSession');

  const key = `${companyId}/${randomUUID()}-${fileName}`;
  const uploadUrl = await getSignedUploadUrl(key, contentType);

  const [doc] = await db
    .insert(documents)
    .values({
      fileName,
      fileUrl: key,
      mimeType: contentType,
      companyId,
      uploadedById: user.id,
    })
    .returning();

  return c.json({ uploadUrl, document: doc });
});

// Get presigned download URL
documentsRoute.get('/:id/download', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) return c.json({ error: 'Not found' }, 404);

  const downloadUrl = await getSignedDownloadUrl(doc.fileUrl);
  return c.json({ downloadUrl });
});

// Delete document
documentsRoute.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) return c.json({ error: 'Not found' }, 404);

  await deleteFile(doc.fileUrl);
  await db.delete(documents).where(eq(documents.id, id));

  return c.json({ success: true });
});

// List documents for a company
documentsRoute.get('/', authMiddleware, async (c) => {
  const companyId = c.req.query('companyId');
  if (!companyId) return c.json({ error: 'companyId required' }, 400);

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.companyId, companyId));

  return c.json({ documents: docs });
});

// Process document with OCR
documentsRoute.post('/:id/process', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { documentType } = await c.req.json();

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) return c.json({ error: 'Not found' }, 404);

  // Download file from R2 as base64
  const downloadUrl = await getSignedDownloadUrl(doc.fileUrl);
  const response = await fetch(downloadUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const result = await processDocumentOCR(
    base64,
    doc.mimeType,
    documentType || 'receipt'
  );

  return c.json({
    documentId: id,
    documentType: documentType || 'receipt',
    ...result,
  });
});

export default documentsRoute;
