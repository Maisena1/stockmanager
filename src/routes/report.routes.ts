import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import {
  lowStockReport,
  monthlyReport,
  purchasesReport,
  salesReport,
  topProductsReport,
} from "../controllers/report.controller";

const router = Router();

// Todo el módulo de reportes es exclusivo del administrador (RF-76 / RF-79).
router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/sales", salesReport);
router.get("/top-products", topProductsReport);
router.get("/low-stock", lowStockReport);
router.get("/purchases", purchasesReport);
router.get("/monthly", monthlyReport);

export default router;
