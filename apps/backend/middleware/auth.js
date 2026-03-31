const { verify } = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = verify(token, process.env.JWT_SECRET);
        const userId = decoded.user?.id;
        if (!userId) {
            return res.status(401).json({ msg: 'Token is not valid' });
        }

        const user = await User.findById(userId).select('role deletedAt');
        if (!user || user.deletedAt) {
            return res.status(401).json({ msg: 'Account is inactive or deleted' });
        }

        req.user = { id: user._id.toString(), role: user.role };
        next();
    } catch (error) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access required' });
    }
    next();
};

module.exports = { auth, adminAuth };
