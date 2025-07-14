// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For creating/verifying JSON Web Tokens
const User = require('../models/User'); // Import the User Mongoose model

const router = express.Router(); // Create an Express router instance

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
    // Destructure email, password, and mood from the request body
    const { email, password, mood } = req.body;

    try {
        // 1. Check if a user with the given email already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User with this email already exists. Please use a different email or log in.' });
        }

        // 2. Hash the password for security
        const salt = await bcrypt.genSalt(10); // Generate a salt (random string) for hashing
        const hashedPassword = await bcrypt.hash(password, salt); // Hash the password with the generated salt

        // 3. Determine the initial avatar based on the provided mood (or a default)
        const avatar = mood ? `${mood.toLowerCase()}_emoji` : 'default_avatar'; // e.g., 'happy_emoji'

        // 4. Create a new User instance
        user = new User({
            email,
            password: hashedPassword,
            avatar
        });

        // 5. Save the new user to the database
        await user.save();

        // 6. Create a JSON Web Token (JWT) for the newly registered user
        // The payload contains information that identifies the user (here, just the user's MongoDB _id)
        const payload = {
            user: {
                id: user.id // Mongoose models provide a virtual 'id' getter for '_id'
            }
        };

        // Sign the JWT: payload, secret key, options (e.g., expiration), and a callback
        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Your secret key from .env
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) throw err; // If there's an error during signing, throw it
                // Send the token, user's avatar, and user ID back to the client
                res.status(201).json({ token, avatar: user.avatar, userId: user.id, msg: 'User registered successfully!' });
            }
        );

    } catch (err) {
        console.error('Signup error:', err.message); // Log the error message
        // Handle Mongoose validation errors (e.g., if email format is wrong, or password too short)
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        // Generic server error for other issues
        res.status(500).send('Server error during signup. Please try again later.');
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    // Destructure email and password from the request body
    const { email, password } = req.body;

    try {
        // 1. Check if a user with the given email exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials. Please check your email and password.' });
        }

        // 2. Compare the provided password with the hashed password stored in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials. Please check your email and password.' });
        }

        // 3. Create a JWT payload for the authenticated user
        const payload = {
            user: {
                id: user.id
            }
        };

        // 4. Sign the JWT and send it back to the client
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                // Send the token, user's avatar, and user ID back
                res.json({ token, avatar: user.avatar, userId: user.id, msg: 'Logged in successfully!' });
            }
        );

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error during login. Please try again later.');
    }
});

module.exports = router; // Export the router to be used in server.js
