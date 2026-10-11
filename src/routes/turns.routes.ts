import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { closeTurno, getTurno, listTurnos } from "../controllers/turns.controller";

const router = Router();

router.use(authenticate);

router.post("/close", closeTurno);
router.get("/", listTurnos);
router.get("/:id", getTurno);

export default router;
