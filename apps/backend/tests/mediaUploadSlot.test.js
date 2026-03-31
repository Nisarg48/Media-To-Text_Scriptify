jest.mock('../controllers/subscriptionController', () => ({
    resolveSubscription: jest.fn(),
}));

const { resolveSubscription } = require('../controllers/subscriptionController');
const { getUploadUrl } = require('../controllers/mediaController');

describe('getUploadUrl media slot limit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 403 MEDIA_SLOT_LIMIT when mediaCount >= maxMediaCount', async () => {
        resolveSubscription.mockResolvedValue({
            plan: 'free',
            mediaCount: 3,
            maxMediaCount: 3,
            maxFileSizeMB: 200,
        });

        const req = {
            user: { id: '507f1f77bcf86cd799439011' },
            body: { fileName: 'a.mp4', fileType: 'video/mp4' },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await getUploadUrl(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'MEDIA_SLOT_LIMIT',
                mediaCount: 3,
                maxMediaCount: 3,
            })
        );
    });
});
