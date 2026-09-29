import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { uploadExcelPhoto } from "../middlewares/upload";
import { preview, runImport } from "../controllers/import.controller";

const router = Router();

router.use(authenticate);

// OJO: multer solo puebla req.body con los campos de texto que llegan ANTES
// del archivo. El frontend tiene que hacer append("config") / append("sheets")
// antes de append("file") en el FormData.
router.post("/preview", requireRole("ADMIN"), uploadExcelPhoto, preview);
router.post("/", requireRole("ADMIN"), uploadExcelPhoto, runImport);

export default router;
