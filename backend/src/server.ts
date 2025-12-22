import express from 'express';
   import dotenv from 'dotenv';
   import cors from 'cors';
   import helmet from 'helmet';
   import { connectDatabase } from './config/database';

   // Load environment variables
   dotenv.config();

   

   const app = express();
   const PORT = process.env.PORT || 5000;

   // Middleware
   app.use(helmet());
   app.use(cors({
     origin: process.env.FRONTEND_URL,
     credentials: true
   }));
   app.use(express.json());
   app.use(express.urlencoded({ extended: true }));

   // Test route
   app.get('/api/health', (req, res) => {
     res.json({ status: 'OK', message: 'PawSync API is running' });
   });

   // Connect to database and start server
   const startServer = async () => {
     try {
       await connectDatabase();
       app.listen(PORT, () => {
         console.log(`🚀 Server running on http://localhost:${PORT}`);
       });
     } catch (error) {
       console.error('Failed to start server:', error);
       process.exit(1);
     }
   };

   startServer();