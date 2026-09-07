import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/roles";
import { uploadPhoto } from "../middlewares/upload";
import { list, getOne, create, update, remove, setPhoto, removePhoto } from "../controllers/articles.controller";
const router = Router();

router.use(authenticate);

router.get("/", list);
router.get("/:code", getOne);
router.post("/", requireRole("ADMIN"), create);
router.put("/:code", requireRole("ADMIN"), update);
router.delete("/:code", requireRole("ADMIN"), remove);
router.post("/:code/photo", requireRole("ADMIN"), uploadPhoto, setPhoto);
router.delete("/:code/photo",requireRole("ADMIN"), removePhoto);
export default router;
