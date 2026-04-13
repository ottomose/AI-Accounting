import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { getSignedUploadUrl, getSignedDownloadUrl, deleteFile } from '../storage/r2';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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

export default documentsRoute;
