import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { uploadExcel } from "../middlewares/upload";
import { preview, importArticles } from "../controllers/import.controller";

const router = Router();

router.use(authenticate);

router.post("/preview", requireRole("ADMIN"), uploadExcel, preview);
router.post("/", requireRole("ADMIN"), uploadExcel, importArticles);

export default router;