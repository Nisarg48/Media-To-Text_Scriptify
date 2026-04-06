const { S3Client } = require('@aws-sdk/client-s3');

// Internal client — used for API operations (delete, head, etc.)
const s3Client = new S3Client({
    region: 'ap-south-1', // Mumbai
    endpoint: process.env.STORAGE_ENDPOINT,
    forcePathStyle: true, // Required for MinIO
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY,
        secretAccessKey: process.env.STORAGE_SECRET_KEY
    }
});

// Public client — used only for presigned URLs sent to the browser.
// STORAGE_PUBLIC_ENDPOINT must be reachable from the user's browser (e.g. http://localhost:9000).
const s3PublicClient = new S3Client({
    region: 'ap-south-1',
    endpoint: process.env.STORAGE_PUBLIC_ENDPOINT || process.env.STORAGE_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY,
        secretAccessKey: process.env.STORAGE_SECRET_KEY
    }
});

module.exports = { s3Client, s3PublicClient };