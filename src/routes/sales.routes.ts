import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { createSale, listSales, lowStock } from "../controllers/sales.controller";

const router = Router();

router.use(authenticate);

router.get("/low-stock", lowStock);
router.get("/", listSales);
router.post("/", createSale);

export default router;
