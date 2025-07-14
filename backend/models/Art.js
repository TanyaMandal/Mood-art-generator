// models/Art.js
const mongoose = require('mongoose');

const artSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Defines a reference to another document's ObjectId
        ref: 'User', // Specifies that this ObjectId refers to the 'User' model
        required: false // CHANGED: userId is now optional
    },
    mood: {
        type: String,
        required: [true, 'Mood is required'],
        trim: true,
        // Enforce specific values for mood to maintain consistency
        enum: {
            values: ['Happy', 'Sad', 'Calm', 'Excited', 'Angry', 'Inspired', 'Mixed'],
            message: 'Mood must be one of: Happy, Sad, Calm, Excited, Angry, Inspired, Mixed'
        }
    },
    imageUrl: {
        type: String,
        required: [true, 'Image URL is required'] // URL where the generated art image is hosted
    },
    prompt: { // The text prompt used to generate the art (e.g., from Mood Diary)
        type: String,
        trim: true,
        default: '' // Default to empty string if no specific prompt beyond mood
    },
    style: { // e.g., 'Abstract', 'Impressionist', chosen from settings
        type: String,
        default: 'Abstract'
    },
    colors: { // Array of preferred colors, e.g., ['red', 'blue'], chosen from settings
        type: [String],
        default: []
    },
    votes: { // Counter for the "Vote" star rating feature in the gallery
        type: Number,
        default: 0
    },
    collaborators: [{ // Array of User IDs who collaborated on this art piece
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now // Automatically sets the creation timestamp
    }
});

// Export the Mongoose model. 'Art' is the name of the collection in MongoDB (will be 'arts').
module.exports = mongoose.model('Art', artSchema);
