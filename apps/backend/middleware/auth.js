const { verify } = require('jsonwebtoken');

const auth = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg:'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({ msg:'No token, authorization denied' });
    }

    try {
        const decoded = verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch(error) {
        res.status(401).json({ msg:'Token is not valid' }); 
    }
};

module.exports = {
    auth
}