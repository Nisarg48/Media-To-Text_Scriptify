const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, lowercase: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['user', 'worker', 'admin'], default: 'user' },
        lastLogin: { type: Date },
        /** Soft-deleted accounts: retained for audit; cannot log in. */
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Unique email among active (non-deleted) users only — allows same email on a deleted row + new signup.
userSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: {
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        },
    }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
