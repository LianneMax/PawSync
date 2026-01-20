"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const database_1 = require("./config/database");
const testRoutes_1 = __importDefault(require("./routes/testRoutes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'PawSync API is running' });
});
// Test routes
app.use('/api/test', testRoutes_1.default);
// 404 handler - must be after all routes
app.use((req, res) => {
    res.status(404).json({
        status: 'ERROR',
        message: `Route ${req.method} ${req.url} not found`
    });
});
// Connect to database and start server
const startServer = async () => {
    try {
        await (0, database_1.connectDatabase)();
        app.listen(PORT, () => {
            console.log('🚀 ================================');
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log('🚀 ================================');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
