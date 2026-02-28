"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const database_1 = require("./config/database");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const petRoutes_1 = __importDefault(require("./routes/petRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const nfcRoutes_1 = __importDefault(require("./routes/nfcRoutes"));
const clinicRoutes_1 = __importDefault(require("./routes/clinicRoutes"));
const verificationRoutes_1 = __importDefault(require("./routes/verificationRoutes"));
const vetApplicationRoutes_1 = __importDefault(require("./routes/vetApplicationRoutes"));
const medicalRecordRoutes_1 = __importDefault(require("./routes/medicalRecordRoutes"));
const appointmentRoutes_1 = __importDefault(require("./routes/appointmentRoutes"));
const vetScheduleRoutes_1 = __importDefault(require("./routes/vetScheduleRoutes"));
const vaccinationRoutes_1 = __importDefault(require("./routes/vaccinationRoutes"));
const vaccineTypeRoutes_1 = __importDefault(require("./routes/vaccineTypeRoutes"));
const confinementRoutes_1 = __importDefault(require("./routes/confinementRoutes"));
const nfcService_1 = require("./services/nfcService");
const nfcWebSocket_1 = require("./websocket/nfcWebSocket");
const seedVaccineTypes_1 = require("./utils/seedVaccineTypes");
const scheduler_1 = require("./utils/scheduler");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Simple CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'https://pawsync.onrender.com',
    credentials: false
}));
// Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health check route
app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', message: 'PawSync API is running' });
});
// Auth routes
app.use('/api/auth', authRoutes_1.default);
// User routes
app.use('/api/users', userRoutes_1.default);
// Pet routes
app.use('/api/pets', petRoutes_1.default);
// Clinic routes
app.use('/api/clinics', clinicRoutes_1.default);
// Verification routes
app.use('/api/verifications', verificationRoutes_1.default);
// Vet application routes
app.use('/api/vet-applications', vetApplicationRoutes_1.default);
// Medical record routes
app.use('/api/medical-records', medicalRecordRoutes_1.default);
// Appointment routes
app.use('/api/appointments', appointmentRoutes_1.default);
// Vet schedule routes
app.use('/api/vet-schedule', vetScheduleRoutes_1.default);
// Vaccination routes
app.use('/api/vaccinations', vaccinationRoutes_1.default);
// Vaccine type routes
app.use('/api/vaccine-types', vaccineTypeRoutes_1.default);
// Confinement / surgery record routes
app.use('/api/confinement', confinementRoutes_1.default);
// NFC routes
app.use('/api/nfc', nfcRoutes_1.default);
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
        await (0, seedVaccineTypes_1.seedVaccineTypes)();
        (0, scheduler_1.startScheduler)();
        const server = http_1.default.createServer(app);
        // Initialize NFC WebSocket (real-time card/reader events)
        (0, nfcWebSocket_1.initNfcWebSocket)(server);
        // Start NFC reader detection only when running locally with USB hardware.
        // On Render (cloud), set NFC_MODE=remote — the local agent handles hardware
        // and sends events via POST /api/nfc/events.
        if (process.env.NFC_MODE !== 'remote') {
            nfcService_1.nfcService.init();
        }
        else {
            console.log('🔌 NFC_MODE=remote — hardware managed by local NFC agent');
        }
        server.listen(PORT, () => {
            console.log('🚀 ================================');
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`🚀 NFC WebSocket at ws://localhost:${PORT}/ws/nfc`);
            console.log('🚀 ================================');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
