import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { create, list, resetCode, update } from "../controllers/user.controller";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/", list);
router.post("/", create);
router.patch("/:id", update);
router.post("/:id/reset-code", resetCode);

export default router;
