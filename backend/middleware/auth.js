// middleware/auth.js
const jwt = require('jsonwebtoken');

// This middleware function verifies the JWT sent in the request header.
// If valid, it decodes the token and attaches the user's payload to req.user.
// If invalid or missing, it sends an appropriate error response.
module.exports = function (req, res, next) {
    // Get token from header. Conventionally, it's sent as 'x-auth-token'.
    const token = req.header('x-auth-token');

    // Check if no token is provided
    if (!token) {
        return res.status(401).json({ msg: 'No authentication token provided. Authorization denied.' });
    }

    // Verify the token
    try {
        // jwt.verify takes the token and the secret key used to sign it.
        // It throws an error if the token is invalid (e.g., expired, tampered).
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user payload (which contains user.id) to the request object.
        // This makes the user's ID available to all subsequent route handlers.
        req.user = decoded.user;
        next(); // Call the next middleware or route handler in the chain
    } catch (err) {
        // Handle specific JWT errors
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Authentication token has expired. Please log in again.' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ msg: 'Invalid authentication token. Authorization denied.' });
        }
        // Catch any other unexpected errors during token verification
        console.error('JWT verification error:', err.message);
        res.status(500).json({ msg: 'Server error during token verification.' });
    }
};
