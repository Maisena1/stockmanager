import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import {
  activeTurno,
  closeTurno,
  getTurno,
  listTurnos,
} from "../controllers/turns.controller";

const router = Router();

router.use(authenticate);

router.post("/close", closeTurno);
// "active" tiene que estar ANTES de /:id: si no Express lo interpreta como id.
router.get("/active", activeTurno);
router.get("/", listTurnos);
router.get("/:id", getTurno);

export default router;
