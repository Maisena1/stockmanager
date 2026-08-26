import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { list, getOne, create, update, remove } from "../controllers/articles.controller";

const router = Router();

router.use(authenticate);

router.get("/", list);
router.get("/:code", getOne);
router.post("/", requireRole("ADMIN"), create);
router.put("/:code", requireRole("ADMIN"), update);
router.delete("/:code", requireRole("ADMIN"), remove);

export default router;
