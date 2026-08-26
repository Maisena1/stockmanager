import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { login, me } from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.get("/me", authenticate, me);

export default router;
