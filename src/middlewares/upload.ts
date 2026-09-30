import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";

const UPLOADS_DIR = path.resolve(process.cwd(),"uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_MB = 1024;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_XLSX_MB = 10000;
const MAX_XLSX_BYTES = MAX_XLSX_MB * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

function sanitizeCode(code:unknown):string {
    return String(code ?? "articulo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 32) || "articulo";    
}


const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (req,file,cb) => {
        const code = sanitizeCode((req.params as Record<string, string>)?.code);
        const ext = EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
        cb(null, `${code}-${Date.now()}${ext}`);
    },
});

const storageExcel = multer.memoryStorage();

function fileFilter(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
): void {
    if (EXT_BY_MIME[file.mimetype]) return cb(null,true);
    cb(new Error("Solo se permiten imagenes (JPEG - PNG - WEBP)"));
}

export const uploadSinglePhoto = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_BYTES},
}).single("photo");

export const uploadExcel = multer({
    storage: storageExcel,
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isExcel = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || ext === ".xlsx";
        if (isExcel) return cb(null, true);
        cb(new Error("Solo se permiten archivos .xlsx"));
    },
    limits: { fileSize: MAX_XLSX_BYTES },
}).single("file");

export function uploadExcelPhoto(req: Request, res: Response, next: NextFunction): void {
    uploadExcel(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: `El archivo supera el límite de ${MAX_XLSX_MB} MB` });
            return;
        }
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        next();
    });
}

export function uploadPhoto(req:Request, res:Response, next:NextFunction):void {
    uploadSinglePhoto(req,res, (err)=> {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: `La foto supera el limite de ${MAX_MB} MB`});
            return;
        }
        if (err) {
            res.status(400).json({ error: err.message});
            return;
        }
        next();
    })
}