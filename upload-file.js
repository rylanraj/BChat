// ...existing code...
const fs = require('fs');
const path = require('path');
// Prefer 'mime' if installed; fallback to 'mime-types'
let mime;
try { mime = require('mime'); } catch (_) {
  try { mime = require('mime-types'); } catch (_) {
    mime = { getType: () => 'b2/x-auto' };
  }
}
const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY
});

async function uploadToB2(localFilePath, options = {}) {
  const {
    prefix = '',
    keepOriginalName = true,
    newFileName = null,
    makePublic = true
  } = options;

  const stat = fs.statSync(localFilePath);
  if (!stat.isFile()) throw new Error('Path is not a file: ' + localFilePath);

  const originalName = path.basename(localFilePath);
  const fileNameOnly = keepOriginalName
    ? originalName
    : (newFileName || Date.now() + '-' + originalName);
  const remoteName = (prefix ? prefix.replace(/\/+$/, '') + '/' : '') + fileNameOnly;

  await b2.authorize();

  const { data: uploadAuth } = await b2.getUploadUrl({
    bucketId: process.env.B2_BUCKET_ID
  });

  const fileBuffer = fs.readFileSync(localFilePath);
  const contentType = mime.getType(originalName) || 'b2/x-auto';

  const { data: uploaded } = await b2.uploadFile({
    uploadUrl: uploadAuth.uploadUrl,
    uploadAuthToken: uploadAuth.authorizationToken,
    fileName: remoteName,
    data: fileBuffer,
    contentType,
    info: { src: 'bchat' }
  });

  const bucketName = process.env.B2_BUCKET_NAME;
  const downloadUrl = b2.downloadUrl; // Use the correct cluster endpoint
  const publicUrl = `${downloadUrl}/file/${bucketName}/${encodeURI(remoteName)}`;

  return {
    fileId: uploaded.fileId,
    fileName: uploaded.fileName,
    size: uploaded.contentLength,
    contentType: uploaded.contentType,
    url: publicUrl
  };
}

// NEW: upload a Buffer directly (used by multer memoryStorage)
async function uploadBufferToB2(buffer, originalName, options = {}) {
  const {
    prefix = 'uploads',
    newFileName = null,
    makePublic = true
  } = options;

  const fileNameOnly = newFileName
    ? newFileName
    : (Date.now() + '-' + originalName);
  const remoteName = (prefix ? prefix.replace(/\/+$/, '') + '/' : '') + fileNameOnly;

  try {
    await b2.authorize();
    const { data: uploadAuth } = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID
    });

    const contentType = mime.getType(originalName) || 'b2/x-auto';

    const { data: uploaded } = await b2.uploadFile({
      uploadUrl: uploadAuth.uploadUrl,
      uploadAuthToken: uploadAuth.authorizationToken,
      fileName: remoteName,
      data: buffer,
      contentType,
      info: { src: 'bchat' }
    });

    const bucketName = process.env.B2_BUCKET_NAME;
    const downloadUrl = b2.downloadUrl; // Use the correct cluster endpoint
    const publicUrl = makePublic
      ? `${downloadUrl}/file/${bucketName}/${encodeURI(remoteName)}`
      : null;

    return {
      fileId: uploaded.fileId,
      fileName: uploaded.fileName,
      size: uploaded.contentLength,
      contentType: uploaded.contentType,
      url: publicUrl,
      remoteName
    };
  } catch (err) {
    console.error('[B2] uploadBufferToB2 error for', remoteName, err && err.response && err.response.data ? err.response.data : err);
    throw err;
  }
}

module.exports = { uploadToB2, uploadBufferToB2 };
// ...existing code...