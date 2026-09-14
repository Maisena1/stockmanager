import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { uploadExcelPhoto } from "../middlewares/upload";
import { preview } from "../controllers/import.controller";

const router = Router();

router.use(authenticate);

router.post("/preview", requireRole("ADMIN"), uploadExcelPhoto, preview);

export default router;