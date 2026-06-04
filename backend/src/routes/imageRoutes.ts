import { Router } from 'express';
import { serveImage } from '../controllers/uploadController';

const router = Router();

router.get('/:id', serveImage);

export default router;
