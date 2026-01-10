import express, { Request, Response } from 'express';
import TestMessage from '../models/TestMessage';

const router = express.Router();

// POST /api/test/hello - Save "Hello" to database
router.post('/hello', async (req: Request, res: Response) => {
  try {
    // Create new message in MongoDB
    const newMessage = await TestMessage.create({
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

  } catch (error) {
    console.error('❌ Error saving to database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save to database'
    });
  }
});

// GET /api/test/messages - Get all messages from database
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const messages = await TestMessage.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

export default router;