const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const { v4: uuidv4 } = require('uuid');
const Media = require('../models/Media');
const { sendToQueue } = require('../config/rabbitmq');
const languages = require('../../shared/languages.json');
const Transcript = require('../models/Transcript');
const Summary = require('../models/Summary');
const mongoose = require('mongoose');

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
        const {
            fileName, fileKey, 
            mediaType, format, 
            targetLanguageCode,
            sourceLanguageCode
        } = req.body;

        if(!fileName || !fileKey || !mediaType || !format) {
            return res.status(400).json({ message: 'File name, file key, media type and format are required' });
        }
        
        if(!targetLanguageCode) {
            return res.status(400).json({ message: 'Target language code is required' });
        }

        const isSupported = languages.some(language => language.code === targetLanguageCode);
        if(!isSupported) {
            return res.status(400).json({ message: `Target language code '${targetLanguageCode}' is not supported` });
        }

        const mode = sourceLanguageCode ? 'FORCED' : 'AUTO';

        const newMedia = new Media({
            mediaUploadedBy: req.user.id,
            filename: fileName,
            mediaType,
            format,
            status: 'UPLOADED',
            sourceLanguageMode: mode,
            sourceLanguageCode: sourceLanguageCode || null,
            targetLanguageCode,
            storage: {
                bucket: process.env.STORAGE_BUCKET_NAME,
                key: fileKey,
                format,
            }
        });

        await newMedia.save();

        // Send the media record to the RabbitMQ queue
        const taskPayload = {
            mediaId: newMedia._id,
            userId: req.user.id,
            fileKey: fileKey,
            targetLanguageCode,
            sourceLanguageCode,
        };

        await sendToQueue(taskPayload);
        
        res.status(201).json({
            msg: "Media record created successfully",
            media: newMedia
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

// @route  GET /api/media
// @desc   Get all media uploads for the logged-in user (search, status filter, pagination)
// @access Private
const getUserMedia = async (req, res) => {
    try {
        const {
            q,
            status,
            page = '1',
            limit = '20',
        } = req.query;

        const query = {
            mediaUploadedBy: req.user.id,
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        };

        if (q && String(q).trim()) {
            query.filename = { $regex: String(q).trim(), $options: 'i' };
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [mediaList, total] = await Promise.all([
            Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .select('-storage'),
            Media.countDocuments(query),
        ]);

        res.status(200).json({
            msg: 'Media list fetched successfully',
            media: mediaList,
            total,
            page: pageNum,
            limit: limitNum,
        });
    } catch (error) {
        console.error('Error fetching user media:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route  GET /api/media/:id
// @desc   Get single media details AND its associated transcript
// @access Private
const getMediaById = async (req, res) => {
    try {
        let media = await Media.findOne({ 
            _id: new mongoose.Types.ObjectId(req.params.id), 
            mediaUploadedBy: req.user.id 
        });

        if (!media) {
            return res.status(404).json({ msg: 'Media not found' });
        }

        if (media.deletedAt) {
            return res.status(404).json({ msg: 'Media not found' });
        }

        const transcript = await Transcript.findOne({ mediaId: media._id });
        const summary = await Summary.findOne({ mediaId: media._id });

        res.status(200).json({
            msg: "Media details fetched successfully",
            media,
            transcript,
            summary: summary || null,
        });

    } catch (error) {
        console.error("Error fetching media details:", error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Media not found' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// @route  DELETE /api/media/:id
// @desc   Soft delete: remove media and transcript files from MinIO, mark media as deleted in DB. Record kept for admin/audit.
// @access Private
const deleteMediaById = async (req, res) => {
    try {
        const media = await Media.findOne({
            _id: new mongoose.Types.ObjectId(req.params.id),
            mediaUploadedBy: req.user.id,
        });

        if (!media) {
            return res.status(404).json({ msg: 'Media not found' });
        }

        if (media.deletedAt) {
            return res.status(400).json({ msg: 'Media is already deleted' });
        }

        // Delete the media file from MinIO (soft fail on error)
        if (media.storage && media.storage.key) {
            const deleteVideoCommand = new DeleteObjectCommand({
                Bucket: process.env.STORAGE_BUCKET_NAME,
                Key: media.storage.key,
            });
            try {
                await s3Client.send(deleteVideoCommand);
            } catch (error) {
                console.warn(`MinIO Video Delete Warning: Could not delete ${media.storage.key}`, error.message);
            }
        }

        // Delete transcript JSON from MinIO; keep Transcript document in DB
        const transcript = await Transcript.findOne({ mediaId: media._id });
        if (transcript && transcript.jsonFile && transcript.jsonFile.key) {
            const deleteJsonCommand = new DeleteObjectCommand({
                Bucket: process.env.STORAGE_BUCKET_NAME,
                Key: transcript.jsonFile.key,
            });
            try {
                await s3Client.send(deleteJsonCommand);
            } catch (error) {
                console.warn(`MinIO JSON Delete Warning: Could not delete ${transcript.jsonFile.key}`, error.message);
            }
        }

        // Mark media as deleted in DB (do not remove Media or Transcript documents)
        media.deletedAt = new Date();
        await media.save();

        res.status(200).json({ msg: 'Media deleted. Files removed from storage; record kept.' });
    } catch (error) {
        console.error("Error deleting media:", error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route  GET /api/media/:id/play
// @desc   Get a temporary presigned URL to stream the video in the React player
// @access Private
const getPlaybackUrl = async (req, res) => {
    try {
        const media = await Media.findOne({
            _id: new mongoose.Types.ObjectId(req.params.id),
            mediaUploadedBy: req.user.id,
        });

        if (!media || !media.storage.key) {
            return res.status(404).json({ msg: 'Media file not found' });
        }

        if (media.deletedAt) {
            return res.status(404).json({ msg: 'Media file not found' });
        }

        // Generate a GET URL valid for 2 hours (7200 seconds)
        const command = new GetObjectCommand({
            Bucket: process.env.STORAGE_BUCKET_NAME,
            Key: media.storage.key,
            ResponseContentDisposition: `inline; filename="${media.filename}"`,
        });

        const playbackUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });

        res.status(200).json({ 
            msg: "Playback URL generated successfully",
            playbackUrl, 
            filename: media.filename 
        });
    } catch (error) {
        console.error("Error generating playback URL:", error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUploadUrl,
    finalizeUpload,
    getUserMedia,
    getMediaById,
    deleteMediaById,
    getPlaybackUrl
};