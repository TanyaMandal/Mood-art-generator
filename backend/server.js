// backend/server.js
// Load environment variables from .env file. This MUST be at the very top.
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const artRoutes = require('./routes/artRoutes');

const app = express();
const PORT = process.env.PORT || 5000; // Use port from environment variable or default to 5000
const MONGO_URI = process.env.MONGO_URI; // Your MongoDB connection string from .env
const JWT_SECRET = process.env.JWT_SECRET; // Secret for JWTs from .env

// --- Basic Environment Variable Validation ---
if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI is not defined in .env. Please check your .env file.');
    process.exit(1); // Exit the process if MongoDB URI is missing
}
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not defined in .env. Please check your .env file.');
    process.exit(1); // Exit the process if JWT Secret is missing
}
if (!process.env.ART_API_URL || !process.env.ART_API_TOKEN) {
    console.warn('WARNING: ART_API_URL or ART_API_TOKEN is not defined. Art generation will use mock data.');
}
// Add warning for Cloudinary credentials
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('WARNING: Cloudinary credentials are not fully defined. Generated images will NOT be permanently stored or accessible via public URLs unless you use a different storage solution.');
}
// --- End Environment Variable Validation ---

// Middleware
app.use(cors()); // Enable CORS for all routes, allowing frontend to make requests
app.use(express.json()); // Body parser middleware to parse JSON request bodies

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        // It's often good practice to exit the process if the database connection fails on startup
        process.exit(1);
    });

// Define a simple test route for the root URL
app.get('/', (req, res) => {
    res.send('Mood-Activated Art Generator Backend API is running!');
});

// Use API routes
app.use('/api/auth', authRoutes); // Routes for user authentication (signup, login)
app.use('/api/art', artRoutes);   // Routes for art generation and management

// Global error handling middleware (catches errors from async operations)
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack); // Log the full stack trace for debugging
    res.status(500).json({ msg: 'Something went wrong on the server.', error: err.message });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
