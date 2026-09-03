import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { login, me, logout, heartbeat } from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/heartbeat", authenticate, heartbeat);
router.get("/me", authenticate, me);

export default router;
