import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/utils/hashing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminCode = await hashPassword("admin123");
  const employeeCode = await hashPassword("empleado123");

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { code: adminCode },
    create: { username: "admin", code: adminCode, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { username: "empleado" },
    update: { code: employeeCode },
    create: { username: "empleado", code: employeeCode, role: "EMPLOYEE" },
  });

  await prisma.article.upsert({
    where: { code: "FIL-001" },
    update: {},
    create: {
      code: "FIL-001",
      name: "Oil Filter",
      category: "Filters",
      motorcycleModel: "Honda CG 150",
      purchasePrice: 2500,
      salePrice: 4000,
      stock: 50,
      minStock: 10,
      supplier: "Repuestos Norte",
    },
  });

  await prisma.article.upsert({
    where: { code: "BUI-001" },
    update: {},
    create: {
      code: "BUI-001",
      name: "NGK Spark Plug",
      category: "Ignition",
      motorcycleModel: "Yamaha FZ 16",
      purchasePrice: 1800,
      salePrice: 3000,
      stock: 5,
      minStock: 8,
      supplier: "Motoparts",
    },
  });

  console.log("Seed complete: admin/admin123, empleado/empleado123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
