import { Request, Response } from "express";
import * as XLSX from "xlsx";

export async function preview(req: Request,
     res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "Archivo requerido" });
  }

  const buffer = req.file.buffer;
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return res.status(400).json({ error: "Archivo XLSX inválido" });
  }

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];
    return { name, rows };
  });

  return res.json({ sheets });
}