// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'], // Custom error message
        unique: true, // Ensures email is unique in the database
        trim: true, // Removes whitespace from both ends of a string
        lowercase: true, // Converts email to lowercase before saving
        match: [/.+@.+\..+/, 'Please enter a valid email address'] // Basic regex validation for email format
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'] // Minimum length validation
    },
    avatar: { // Stores a string identifier for the user's mood-based avatar
        type: String,
        default: 'default_avatar' // Default avatar if no mood is provided during signup
    },
    createdAt: {
        type: Date,
        default: Date.now // Automatically sets the creation date
    }
});

// Export the Mongoose model. 'User' is the name of the collection in MongoDB (will be 'users').
module.exports = mongoose.model('User', userSchema);
