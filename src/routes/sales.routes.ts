import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { createSale, listSales } from "../controllers/sales.controller";

const router = Router();

router.use(authenticate);

router.get("/", listSales);
router.post("/", createSale);

export default router;
