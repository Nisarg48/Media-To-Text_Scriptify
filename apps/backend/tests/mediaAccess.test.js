jest.mock('../models/Media');

const mongoose = require('mongoose');
const Media = require('../models/Media');
const { assertUserOwnsMedia } = require('../middleware/mediaAccess');

function makeRes() {
  const res = { _statusCode: null, _body: null };
  res.status = (code) => { res._statusCode = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

const userId = new mongoose.Types.ObjectId().toString();
const mediaId = new mongoose.Types.ObjectId().toString();

describe('assertUserOwnsMedia', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the media doc when user owns it', async () => {
    const fakeMedia = { _id: new mongoose.Types.ObjectId(mediaId), deletedAt: null };
    Media.findOne.mockResolvedValue(fakeMedia);

    const req = { user: { id: userId } };
    const res = makeRes();

    const result = await assertUserOwnsMedia(req, res, mediaId);

    expect(result).toBe(fakeMedia);
    expect(res._statusCode).toBeNull();
    expect(Media.findOne).toHaveBeenCalledWith({
      _id: expect.any(mongoose.Types.ObjectId),
      mediaUploadedBy: userId,
    });
  });

  it('returns null + 404 when findOne returns null (another user or not found)', async () => {
    Media.findOne.mockResolvedValue(null);

    const req = { user: { id: userId } };
    const res = makeRes();

    const result = await assertUserOwnsMedia(req, res, mediaId);

    expect(result).toBeNull();
    expect(res._statusCode).toBe(404);
    expect(res._body).toEqual({ msg: 'Media not found' });
  });

  it('returns null + 404 for soft-deleted media', async () => {
    const fakeMedia = { _id: new mongoose.Types.ObjectId(mediaId), deletedAt: new Date() };
    Media.findOne.mockResolvedValue(fakeMedia);

    const req = { user: { id: userId } };
    const res = makeRes();

    const result = await assertUserOwnsMedia(req, res, mediaId);

    expect(result).toBeNull();
    expect(res._statusCode).toBe(404);
  });

  it('returns null + 404 for invalid (non-ObjectId) media ID', async () => {
    const req = { user: { id: userId } };
    const res = makeRes();

    const result = await assertUserOwnsMedia(req, res, 'not-a-valid-id');

    expect(result).toBeNull();
    expect(res._statusCode).toBe(404);
    expect(Media.findOne).not.toHaveBeenCalled();
  });
});
