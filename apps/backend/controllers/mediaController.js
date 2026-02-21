const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const { v4: uuidv4 } = require('uuid');
const Media = require('../models/Media');

// @route  POST /api/media/presigned-url
// @desc   Get a presigned URL for uploading media
// @access Private
const getUploadUrl = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileName, fileType } = req.body;

        if(!fileName || !fileType) {
            return res.status(400).json({ message: 'File name and type are required' });
        }

        const fileKey = `media/${userId}/${uuidv4()}_${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.STORAGE_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        res.json({ uploadUrl, fileKey });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

// @route  POST /api/media/finalize
// @desc   Save media record to DB after successful S3 upload
// @access Private
const finalizeUpload = async (req, res) => {
    try {
        const {fileName, fileKey, sizeBytes, mediaType, format} = req.body;

        const newMedia = new Media({
            mediaUploadedBy: req.user.id,
            filename: fileName,
            sizeBytes,
            mediaType,
            format,
            status: 'UPLOADED',
            storage: {
                bucket: process.env.STORAGE_BUCKET_NAME,
                key: fileKey,
                format,
                sizeBytes
            }
        });

        await newMedia.save();

        res.status(201).json({
            msg: "Media record created successfully",
            media: newMedia
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

module.exports = {
    getUploadUrl,
    finalizeUpload
};