import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/utils/hashing";
import { generateCode } from "../src/utils/codigo";
import { calculateSalePrice } from "../src/utils/precio";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const demoArticles = [
  { name: "Filtro de Aceite", category: "Filtros", motorcycleModel: "CG 125/150", purchasePrice: 2500, margen: 60, stock: 50, minStock: 10, supplier: "Repuestos Norte" },
  { name: "Filtro de Aire", category: "Filtros", motorcycleModel: "Wave/Falcon", purchasePrice: 1800, margen: 55, stock: 40, minStock: 8, supplier: "Repuestos Norte" },
  { name: "Bujía NGK", category: "Ignición", motorcycleModel: "CG 125/150", purchasePrice: 1800, margen: 50, stock: 5, minStock: 8, supplier: "Motoparts" },
  { name: "Pastillas de Freno Delanteras", category: "Frenos", motorcycleModel: "CG 125/150", purchasePrice: 4200, margen: 50, stock: 30, minStock: 6, supplier: "Frenos SRL" },
  { name: "Pastillas de Freno Traseras", category: "Frenos", motorcycleModel: "CG 125/150", purchasePrice: 3800, margen: 50, stock: 25, minStock: 6, supplier: "Frenos SRL" },
  { name: "Cadena de Transmisión", category: "Transmisión", motorcycleModel: "CG 125/150", purchasePrice: 8500, margen: 50, stock: 15, minStock: 3, supplier: "Transmisión SA" },
  { name: "Piñón Trasero", category: "Transmisión", motorcycleModel: "CG 125/150", purchasePrice: 4200, margen: 50, stock: 12, minStock: 4, supplier: "Transmisión SA" },
  { name: "Corona Trasera", category: "Transmisión", motorcycleModel: "CG 125/150", purchasePrice: 5800, margen: 50, stock: 10, minStock: 3, supplier: "Transmisión SA" },
  { name: "Amortiguador Delantero", category: "Suspensión", motorcycleModel: "CG 125/150", purchasePrice: 18500, margen: 40, stock: 6, minStock: 2, supplier: "Suspensión Plus" },
  { name: "Amortiguador Trasero", category: "Suspensión", motorcycleModel: "CG 125/150", purchasePrice: 16500, margen: 40, stock: 4, minStock: 2, supplier: "Suspensión Plus" },
  { name: "Aceite 10W-40", category: "Lubricantes", motorcycleModel: "General", purchasePrice: 4200, margen: 60, stock: 60, minStock: 15, supplier: "LubriMax" },
  { name: "Grasa Multipropósito", category: "Lubricantes", motorcycleModel: "General", purchasePrice: 1500, margen: 60, stock: 40, minStock: 10, supplier: "LubriMax" },
  { name: "Foco Delantero", category: "Eléctrico", motorcycleModel: "Wave", purchasePrice: 2200, margen: 50, stock: 20, minStock: 5, supplier: "Eléctrica Moto" },
  { name: "Regulador de Voltaje", category: "Eléctrico", motorcycleModel: "CG 125", purchasePrice: 8500, margen: 40, stock: 8, minStock: 3, supplier: "Eléctrica Moto" },
  { name: "Bobina de Encendido", category: "Ignición", motorcycleModel: "CG 125/150", purchasePrice: 9500, margen: 40, stock: 6, minStock: 2, supplier: "Motoparts" },
  { name: "Diafragma de Carburador", category: "Carburación", motorcycleModel: "CG 125", purchasePrice: 2500, margen: 50, stock: 15, minStock: 4, supplier: "Carburación SA" },
  { name: "Jeringa de Carburador", category: "Carburación", motorcycleModel: "CG 125", purchasePrice: 1500, margen: 60, stock: 2, minStock: 5, supplier: "Carburación SA" },
  { name: "Kit de Empaques", category: "Motor", motorcycleModel: "CG 125", purchasePrice: 5800, margen: 50, stock: 10, minStock: 3, supplier: "Motor Repuestos" },
  { name: "Retén de Cigüeñal", category: "Motor", motorcycleModel: "CG 125", purchasePrice: 3200, margen: 50, stock: 12, minStock: 3, supplier: "Motor Repuestos" },
  { name: "Cámara de Aire", category: "Neumáticos", motorcycleModel: "2.50-18", purchasePrice: 2500, margen: 60, stock: 20, minStock: 6, supplier: "Gomas Norte" },
  { name: "Cubierta 2.50-18", category: "Neumáticos", motorcycleModel: "CG 125", purchasePrice: 18500, margen: 40, stock: 8, minStock: 2, supplier: "Gomas Norte" },
  { name: "Manillar Completo", category: "Chasis", motorcycleModel: "CG 125", purchasePrice: 8500, margen: 45, stock: 5, minStock: 2, supplier: "Chasis SA" },
  { name: "Palanca de Cambio", category: "Transmisión", motorcycleModel: "CG 125/150", purchasePrice: 2800, margen: 50, stock: 3, minStock: 5, supplier: "Transmisión SA" },
  { name: "Interruptor de Luces", category: "Eléctrico", motorcycleModel: "Wave", purchasePrice: 3200, margen: 50, stock: 7, minStock: 3, supplier: "Eléctrica Moto" },
  { name: "Soporte de Espejo", category: "Accesorios", motorcycleModel: "General", purchasePrice: 1200, margen: 60, stock: 4, minStock: 5, supplier: "Accesorios Moto" }
];

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

  for (const art of demoArticles) {
    const code = await generateCode(art.name);
    await prisma.article.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: art.name,
        category: art.category,
        motorcycleModel: art.motorcycleModel,
        purchasePrice: art.purchasePrice,
        salePrice: calculateSalePrice(art.purchasePrice, art.margen),
        stock: art.stock,
        minStock: art.minStock,
        supplier: art.supplier,
      },
    });
  }

  console.log(`Seed DEMO completo: admin/admin123, empleado/empleado123, ${demoArticles.length} artículos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
