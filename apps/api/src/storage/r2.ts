import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    { expiresIn }
  );
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600
) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function deleteFile(key: string) {
  await r2.send(
    new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );
}
