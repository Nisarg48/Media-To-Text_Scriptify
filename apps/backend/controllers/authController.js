const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { logSubscriptionEvent } = require('../services/subscriptionAuditService');
const { purgeUserMediaAndRelatedStorage } = require('../services/userAccountPurgeService');

/**
 * Derive role from email pattern:
 *   *.admin@scriptify.com  → 'admin'
 *   *@scriptify.com        → 'worker'
 *   anything else          → 'user'
 */
function getRoleFromEmail(email) {
    const lower = email.toLowerCase();
    if (lower.endsWith('.admin@scriptify.com') || lower === 'admin@scriptify.com') return 'admin';
    if (lower.endsWith('@scriptify.com')) return 'worker';
    return 'user';
}

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
const register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, initialPlan = 'free' } = req.body;
    const planChoice = initialPlan === 'pro' ? 'pro' : 'free';

    try {
        const emailNorm = email.toLowerCase();
        let user = await User.findOne({ email: emailNorm });
        if (user && !user.deletedAt) {
            return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
        }

        const role = getRoleFromEmail(emailNorm);
        user = new User({ name, email: emailNorm, password, role });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        if (planChoice === 'free') {
            await Subscription.create({
                userId: user._id,
                plan: 'free',
                status: 'active',
            });
            await logSubscriptionEvent({
                userId: user._id,
                action: 'signup_free',
                toPlan: 'free',
                metadata: { source: 'email_registration' },
            });
        } else {
            await logSubscriptionEvent({
                userId: user._id,
                action: 'signup_chose_pro',
                toPlan: 'pro',
                metadata: { source: 'email_registration', next: 'stripe_checkout' },
            });
        }

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({ token, initialPlan: planChoice });
    } catch (err) {
        console.error(err.message);
        return res.status(500).send('Server error');
    }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const emailNorm = email.toLowerCase();
        let user = await User.findOne({ email: emailNorm });
        if (!user || user.deletedAt) {
            return res.status(400).json({ errors: [{ msg: 'Invalid Credentials' }] });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ errors: [{ msg: 'Invalid Credentials' }] });
        }

        user.lastLogin = Date.now();
        await user.save();

        // Derive role: DB value takes precedence; fall back to email pattern for legacy users
        const role = user.role || getRoleFromEmail(user.email);

        const payload = { user: { id: user.id, role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({ msg: 'Login successful', token });
    } catch (err) {
        console.error(err.message);
        return res.status(500).send('Server error');
    }
};

// @route   GET /api/auth/me
// @desc    Current user profile (no password)
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('name email role createdAt');
        if (!user) {
            return res.status(401).json({ msg: 'Account is inactive or deleted' });
        }
        return res.json({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
        });
    } catch (err) {
        console.error('authController.getMe:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route   PATCH /api/auth/me
// @desc    Update display name
// @access  Private
const updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user || user.deletedAt) {
            return res.status(401).json({ msg: 'Account is inactive or deleted' });
        }
        user.name = String(req.body.name).trim();
        await user.save();
        return res.json({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (err) {
        console.error('authController.updateProfile:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { newPassword } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user || user.deletedAt) {
            return res.status(401).json({ msg: 'Account is inactive or deleted' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return res.json({ msg: 'Password updated successfully' });
    } catch (err) {
        console.error('authController.changePassword:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route   POST /api/auth/delete-account
// @desc    Purge user media from storage, soft-delete all media rows, soft-delete user (retain DB row)
// @access  Private
const deleteAccount = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user || user.deletedAt) {
            return res.status(401).json({ msg: 'Account is inactive or deleted' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Password is incorrect' });
        }

        await purgeUserMediaAndRelatedStorage(user._id);

        user.deletedAt = new Date();
        await user.save();

        return res.json({
            msg: 'Your account has been closed. Your profile is retained for our records; you can no longer sign in.',
        });
    } catch (err) {
        console.error('authController.deleteAccount:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = { register, login, getMe, updateProfile, changePassword, deleteAccount };
