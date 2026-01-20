"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TestMessage_1 = __importDefault(require("../models/TestMessage"));
const router = express_1.default.Router();
// POST /api/test/hello - Save "Hello" to database
router.post('/hello', async (req, res) => {
    try {
        // Create new message in MongoDB
        const newMessage = await TestMessage_1.default.create({
            message: 'Hello from frontend!'
        });
        console.log('✅ Saved to MongoDB:', newMessage);
        res.status(201).json({
            success: true,
            message: 'Hello saved to database!',
            data: {
                id: newMessage._id,
                message: newMessage.message,
                createdAt: newMessage.createdAt
            }
        });
    }
    catch (error) {
        console.error('❌ Error saving to database:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save to database'
        });
    }
});
// GET /api/test/messages - Get all messages from database
router.get('/messages', async (req, res) => {
    try {
        const messages = await TestMessage_1.default.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: messages.length,
            data: messages
        });
    }
    catch (error) {
        console.error('❌ Error fetching messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});
exports.default = router;
