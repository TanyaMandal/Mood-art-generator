// routes/artRoutes.js
const express = require('express');
const axios = require('axios'); // For making HTTP requests to external APIs
const cloudinary = require('cloudinary').v2; // Import Cloudinary SDK
const Art = require('../models/Art'); // Import the Art Mongoose model
const User = require('../models/User'); // Import the User Mongoose model for collaborator lookup
const jwt = require('jsonwebtoken'); // To optionally decode token if present

const router = express.Router(); // Create an Express router instance

// Configure Cloudinary with credentials from .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Helper function to call the external art generation API and upload to Cloudinary ---
// This function encapsulates the logic for interacting with the AI art service.
async function generateArtFromAPI(prompt) {
    // Basic validation for the prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        throw new Error('Art generation prompt cannot be empty or invalid.');
    }

    const ART_API_URL = process.env.ART_API_URL;
    const ART_API_TOKEN = process.env.ART_API_TOKEN;

    // --- Fallback to mock images if AI API or Cloudinary credentials are not fully set ---
    if (!ART_API_URL || !ART_API_TOKEN || !cloudinary.config().cloud_name || !cloudinary.config().api_key || !cloudinary.config().api_secret) {
        console.warn('AI API or Cloudinary credentials are missing. Using mock image generation for development.');
        const mockImageUrls = {
            'happy': 'https://placehold.co/600x450/FFD700/000000?text=Happy+Art',
            'sad': 'https://placehold.co/600x450/87CEEB/FFFFFF?text=Sad+Art',
            'calm': 'https://placehold.co/600x450/90EE90/000000?text=Calm+Art',
            'excited': 'https://placehold.co/600x450/FF6347/FFFFFF?text=Excited+Art',
            'angry': 'https://placehold.co/600x450/DC143C/FFFFFF?text=Angry+Art',
            'inspired': 'https://placehold.co/600x450/BA55D3/FFFFFF?text=Inspired+Art',
            'mixed': 'https://placehold.co/600x450/CCCCCC/000000?text=Mixed+Art',
            'default': 'https://placehold.co/600x450/A9A9A9/FFFFFF?text=Generated+Art'
        };
        const cleanedPrompt = prompt.toLowerCase().split(',')[0].trim(); // Extract first mood for mock
        const generatedImageUrl = mockImageUrls[cleanedPrompt] || mockImageUrls['default'];

        // Simulate API call delay for time-lapse effect on frontend
        await new Promise(resolve => setTimeout(resolve, 3000));
        return generatedImageUrl;
    }
    // --- End Fallback ---

    try {
        // 1. Call the external AI image generation API (e.g., Hugging Face)
        const response = await axios.post(
            ART_API_URL,
            { inputs: prompt },
            {
                headers: {
                    'Authorization': `Bearer ${ART_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer' // Important: Get response as binary data (image)
            }
        );

        // 2. Convert the binary image data to a base64 data URI
        // This format is suitable for uploading to Cloudinary
        const contentType = response.headers['content-type'] || 'image/png'; // Default to png if not specified
        const base64Image = Buffer.from(response.data).toString('base64');
        const dataURI = `data:${contentType};base64,${base64Image}`;

        // 3. Upload the image to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: 'mood_art_generator', // Optional: organize uploads in a specific folder
            use_filename: true, // Use original filename (or a generated one)
            unique_filename: false, // Don't add random string to filename (Cloudinary handles uniqueness)
            overwrite: false, // Don't overwrite if file with same name exists (Cloudinary handles this)
            tags: [prompt.toLowerCase().split(',')[0].trim(), 'mood_art'] // Add tags for organization
        });

        // 4. Return the secure URL of the uploaded image from Cloudinary
        return uploadResult.secure_url;

    } catch (error) {
        console.error('Error generating art from external API or uploading to Cloudinary:', error.response ? error.response.data : error.message);
        // Provide a more specific error message based on the source of the error
        if (error.response && error.response.status === 401) {
            throw new Error('AI API authentication failed. Check your ART_API_TOKEN.');
        }
        if (error.response && error.response.status === 429) {
            throw new Error('AI API rate limit exceeded. Please try again later.');
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error('Could not connect to AI API. Check ART_API_URL or your internet connection.');
        }
        throw new Error('Failed to generate art from external service or upload image.');
    }
}

// Middleware to optionally get user ID from token if present, but not enforce it.
// This allows both authenticated and unauthenticated requests.
const optionalAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded.user; // Attach user info if token is valid
        } catch (err) {
            // If token is invalid, just log it, don't block the request.
            // The request will proceed as unauthenticated.
            console.warn('Optional auth: Invalid token provided, proceeding as unauthenticated.');
        }
    }
    next(); // Always call next, whether token was present/valid or not
};


// @route   POST /api/art
// @desc    Generate and save a new art piece based on mood/prompt
// @access  Public (authentication is optional)
router.post('/', optionalAuth, async (req, res) => {
    const { mood, prompt, style, colors } = req.body;
    // userId will be present if authenticated, otherwise undefined
    const userId = req.user ? req.user.id : null;

    try {
        // Construct the full prompt string to send to the art generation API
        let artPrompt = mood;
        if (prompt) { // If Mood Diary text is provided
            artPrompt = `${mood ? mood + ', ' : ''}${prompt}`;
        }
        if (style) {
            artPrompt += `, in ${style} style`;
        }
        if (colors && colors.length > 0) {
            artPrompt += `, with colors ${colors.join(', ')}`;
        }

        const imageUrl = await generateArtFromAPI(artPrompt);

        // Create a new Art document instance
        const newArt = new Art({
            userId, // This will be null if not authenticated, which is now allowed by the schema
            mood: mood || 'Mixed', // Default to 'Mixed' if only prompt (e.g., from diary)
            imageUrl,
            prompt,
            style,
            colors
        });

        // Save the new art piece to the database
        await newArt.save();
        // Respond with the newly created art object and a 201 Created status
        res.status(201).json(newArt);

    } catch (err) {
        console.error('Error in POST /api/art:', err.message);
        // Handle Mongoose validation errors or custom errors from generateArtFromAPI
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).json({ msg: err.message || 'Server error generating art.' });
    }
});

// @route   GET /api/art/history
// @desc    Get all art pieces for the authenticated user (or none if not logged in)
// @access  Public (authentication is optional)
router.get('/history', optionalAuth, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        let userArt = [];
        if (userId) {
            // Only fetch art if a user is logged in
            userArt = await Art.find({ userId }).sort({ createdAt: -1 });
        }
        // If not logged in, return an empty array or a message
        res.json(userArt);
    } catch (err) {
        console.error('Error in GET /api/art/history:', err.message);
        res.status(500).json({ msg: 'Server error fetching art history.' });
    }
});

// @route   POST /api/art/:id/vote
// @desc    Increment vote count for an art piece
// @access  Public (authentication is optional)
router.post('/:id/vote', optionalAuth, async (req, res) => {
    try {
        // Find the art piece by its ID from the URL parameters
        const art = await Art.findById(req.params.id);
        if (!art) {
            return res.status(404).json({ msg: 'Art piece not found.' });
        }

        // You might want to track who voted to prevent multiple votes from one user
        // For simplicity, we just increment.
        art.votes += 1;
        // Save the updated art piece back to the database
        await art.save();
        res.json(art); // Respond with the updated art object

    } catch (err) {
        console.error('Error in POST /api/art/:id/vote:', err.message);
        res.status(500).json({ msg: 'Server error processing vote.' });
    }
});

// @route   GET /api/art/evolution/:mood
// @desc    Get art pieces for a specific mood, ordered by creation time (for timeline)
// @access  Public (authentication is optional)
router.get('/evolution/:mood', optionalAuth, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const mood = req.params.mood; // Get mood from URL parameter

        let artEvolution = [];
        if (userId) {
            // Only fetch evolution if a user is logged in
            artEvolution = await Art.find({ userId, mood }).sort({ createdAt: 1 });
        }
        res.json(artEvolution);
    } catch (err) {
        console.error('Error in GET /api/art/evolution/:mood:', err.message);
        res.status(500).json({ msg: 'Server error fetching art evolution data.' });
    }
});

// @route   POST /api/art/collaborate
// @desc    Generate a collaborative art piece from two moods
// @access  Public (authentication is optional)
router.post('/collaborate', optionalAuth, async (req, res) => {
    const { mood1, mood2, partnerEmail } = req.body;
    // userId will be present if authenticated, otherwise null
    const userId = req.user ? req.user.id : null;

    if (!mood1 || !mood2) {
        return res.status(400).json({ msg: 'Both moods are required for collaboration.' });
    }

    try {
        let partnerUserId = null;
        if (partnerEmail) {
            const partner = await User.findOne({ email: partnerEmail });
            if (partner) {
                partnerUserId = partner.id;
            } else {
                console.warn(`Collaborator email ${partnerEmail} not found. Proceeding without specific partner ID.`);
            }
        }

        const artPrompt = `Collaborative art blending ${mood1} and ${mood2}`;
        const imageUrl = await generateArtFromAPI(artPrompt);

        // Collect all collaborators, ensuring unique IDs.
        // If userId is null (unauthenticated), it won't be added.
        const collaborators = [];
        if (userId) {
            collaborators.push(userId);
        }
        if (partnerUserId && partnerUserId !== userId) {
            collaborators.push(partnerUserId);
        }

        const newArt = new Art({
            userId: userId, // Will be null if unauthenticated
            mood: `${mood1} & ${mood2}`,
            imageUrl,
            prompt: artPrompt,
            collaborators: [...new Set(collaborators)] // Ensure unique collaborator IDs
        });

        await newArt.save();
        res.status(201).json(newArt);

    } catch (err) {
        console.error('Error in POST /api/art/collaborate:', err.message);
        res.status(500).json({ msg: err.message || 'Server error blending moods for collaboration.' });
    }
});

module.exports = router; // Export the router to be used in server.js
