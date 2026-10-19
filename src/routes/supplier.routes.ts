import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import {
  create,
  impact,
  list,
  listOptions,
  remove,
  update,
} from "../controllers/supplier.controller";

const router = Router();

router.use(authenticate);

// El POS lo usan empleados: sólo id y nombre, sin datos de contacto.
router.get("/options", listOptions);

router.use(requireRole("ADMIN"));

router.get("/", list);
router.post("/", create);
router.get("/:id/impact", impact);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
