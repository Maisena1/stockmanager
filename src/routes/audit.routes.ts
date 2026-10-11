import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { listAudit, listUsers } from "../controllers/audit.controller";

const router = Router();

router.use(authenticate);

router.get("/users", requireRole("ADMIN"), listUsers);
router.get("/", requireRole("ADMIN"), listAudit);

export default router;
