const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    deleteAccount,
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 8 characters').isLength({ min: 8 }),
    check('initialPlan').optional().isIn(['free', 'pro']).withMessage('initialPlan must be free or pro'),
], register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
], login);

// @route   GET /api/auth/me
router.get('/me', auth, getMe);

// @route   PATCH /api/auth/me
router.patch('/me', auth, [check('name', 'Name is required').trim().not().isEmpty()], updateProfile);

// @route   POST /api/auth/change-password
router.post('/change-password', auth, [
    check('newPassword', 'New password must be at least 8 characters').isLength({ min: 8 }),
], changePassword);

// @route   POST /api/auth/delete-account
router.post('/delete-account', auth, [
    check('password', 'Password is required to delete your account').exists(),
], deleteAccount);

module.exports = router;
