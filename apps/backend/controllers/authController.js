const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { logSubscriptionEvent } = require('../services/subscriptionAuditService');

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
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
        }

        const role = getRoleFromEmail(email);
        user = new User({ name, email, password, role });

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
        let user = await User.findOne({ email });
        if (!user) {
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

module.exports = { register, login };
