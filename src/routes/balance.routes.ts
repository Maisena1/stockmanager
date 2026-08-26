import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { today, range } from "../controllers/balance.controller";

const router = Router();

router.use(authenticate);

router.get("/today", today);
router.get("/", range);

export default router;