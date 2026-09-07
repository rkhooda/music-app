import { Router } from 'express';
import { getStreamUrl, prefetch, searchMusic, streamAudio } from '../controllers/musicController';

const router = Router();

router.get('/search', searchMusic);
router.get('/url/:videoId', getStreamUrl);
router.get('/stream/:videoId', streamAudio);
router.post('/prefetch', prefetch);

export default router;
