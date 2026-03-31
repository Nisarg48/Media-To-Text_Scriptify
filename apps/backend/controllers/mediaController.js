const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const { v4: uuidv4 } = require('uuid');
const Media = require('../models/Media');
const { sendToQueue } = require('../config/rabbitmq');
const languages = require('../../shared/languages.json');
const Transcript = require('../models/Transcript');
const Summary = require('../models/Summary');
const mongoose = require('mongoose');
const { resolveSubscription } = require('./subscriptionController');
const { buildDashboardMediaMatch } = require('../utils/dashboardMediaQuery');
const { deleteStoredObjectsForMedia } = require('../services/mediaStorageCleanup');

// @route  POST /api/media/presigned-url
// @desc   Get a presigned URL for uploading media
// @access Private
const getUploadUrl = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileName, fileType, sizeBytes } = req.body;

        if(!fileName || !fileType) {
            return res.status(400).json({ message: 'File name and type are required' });
        }

        const sub = await resolveSubscription(userId);

        if (sub.mediaCount >= sub.maxMediaCount) {
            return res.status(403).json({
                message: `Your ${sub.plan === 'free' ? 'Free' : 'Pro'} plan allows ${sub.maxMediaCount} media file${sub.maxMediaCount !== 1 ? 's' : ''} at a time. Delete an existing file or upgrade to upload more.`,
                code: 'MEDIA_SLOT_LIMIT',
                plan: sub.plan,
                mediaCount: sub.mediaCount,
                maxMediaCount: sub.maxMediaCount,
            });
        }

        // Enforce plan file-size limit
        if (sizeBytes && typeof sizeBytes === 'number' && sizeBytes > 0) {
            const limitBytes = sub.maxFileSizeMB * 1024 * 1024;
            if (sizeBytes > limitBytes) {
                return res.status(403).json({
                    message: `Your ${sub.plan === 'free' ? 'Free' : 'Pro'} plan allows files up to ${sub.maxFileSizeMB} MB. This file is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB.`,
                    code: 'FILE_TOO_LARGE',
                    plan: sub.plan,
                    maxFileSizeMB: sub.maxFileSizeMB,
                });
            }
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
            sourceLanguageCode,
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

        // Enforce plan limits: media slots, parallel job cap
        const sub = await resolveSubscription(req.user.id);

        if (sub.mediaCount >= sub.maxMediaCount) {
            return res.status(403).json({
                message: `Your ${sub.plan === 'free' ? 'Free' : 'Pro'} plan allows ${sub.maxMediaCount} media file${sub.maxMediaCount !== 1 ? 's' : ''} at a time. Delete an existing file or upgrade to upload more.`,
                code: 'MEDIA_SLOT_LIMIT',
                plan: sub.plan,
                mediaCount: sub.mediaCount,
                maxMediaCount: sub.maxMediaCount,
            });
        }

        const activeJobs = await Media.countDocuments({
            mediaUploadedBy: req.user.id,
            status: { $in: ['UPLOADED', 'PROCESSING'] },
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        });
        if (activeJobs >= sub.maxParallelJobs) {
            return res.status(403).json({
                message: `Your ${sub.plan === 'free' ? 'Free' : 'Pro'} plan allows ${sub.maxParallelJobs} parallel job${sub.maxParallelJobs !== 1 ? 's' : ''}. Wait for a current job to finish before submitting another.`,
                code: 'PARALLEL_JOB_LIMIT',
                plan: sub.plan,
                maxParallelJobs: sub.maxParallelJobs,
            });
        }

        const mode = sourceLanguageCode ? 'FORCED' : 'AUTO';
        const retentionMs = (sub.retentionDays ?? 15) * 86400000;

        const newMedia = new Media({
            mediaUploadedBy: req.user.id,
            filename: fileName,
            mediaType,
            format,
            status: 'UPLOADED',
            sourceLanguageMode: mode,
            sourceLanguageCode: sourceLanguageCode || null,
            targetLanguageCode,
            retentionExpiresAt: new Date(Date.now() + retentionMs),
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

        const built = buildDashboardMediaMatch(req.query, req.user.id);
        if (built.error) {
            return res.status(built.error.status).json({ message: built.error.msg });
        }

        const andClauses = [...built.match.$and];

        if (q && String(q).trim()) {
            andClauses.push({ filename: { $regex: String(q).trim(), $options: 'i' } });
        }

        if (status && status !== 'all') {
            andClauses.push({ status });
        }

        const matchQuery = { $and: andClauses };

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        // Use aggregation $match (same as analytics) so nested $and/$or behaves like dashboard stats.
        const [facetResult] = await Media.aggregate([
            { $match: matchQuery },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $project: {
                                storage: 0,
                                derivedAudio: 0,
                            },
                        },
                    ],
                    total: [{ $count: 'n' }],
                },
            },
        ]);

        const mediaList = facetResult?.data ?? [];
        const total = facetResult?.total?.[0]?.n ?? 0;

        res.set('Cache-Control', 'private, no-store');
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

        await deleteStoredObjectsForMedia(media);

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