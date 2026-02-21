const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: 'ap-south-1', // Mumbai
    endpoint: process.env.STORAGE_ENDPOINT,
    forcePathStyle: true, // Required for MinIO
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY,
        secretAccessKey: process.env.STORAGE_SECRET_KEY
    }
});

module.exports = { s3Client };