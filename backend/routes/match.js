// /routes/match.js
import express from 'express';
import { checkForMatchingOffers } from '../controllers/matchController.js';

const router = express.Router();

router.post('/', checkForMatchingOffers);

export default router;
