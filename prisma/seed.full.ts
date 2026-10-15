import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/utils/hashing";
import { generateCode } from "../src/utils/codigo";
import { calculateSalePrice } from "../src/utils/precio";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = ["Filtros", "Ignición", "Frenos", "Transmisión", "Suspensión", "Lubricantes", "Eléctrico", "Carburación", "Motor", "Neumáticos", "Chasis", "Accesorios", "Embrague"];
const models = ["CG 125", "CG 150", "Titan 150", "Wave", "Falcon", "FZ 16", "Fazer", "XTZ 125", "GN 125", "AX 100", "Boxer", "Discover 125", "Pulsar 125", "Motomel", "Corven", "Zanella", "General"];
const suppliers = ["Repuestos Norte", "Motoparts", "Frenos SRL", "Transmisión SA", "Suspensión Plus", "LubriMax", "Eléctrica Moto", "Carburación SA", "Motor Repuestos", "Gomas Norte", "Chasis SA", "Accesorios Moto", "Repuestos Sur", "MotoStock", "Repuestos Express"];

const baseItems = [
  "Filtro de Aceite", "Filtro de Aire", "Filtro de Combustible", "Bujía", "Bujía Iridium", "Pastillas de Freno Delanteras", "Pastillas de Freno Traseras", "Zapatillas de Freno", "Disco de Freno", "Tambor de Freno",
  "Cadena de Transmisión", "Piñón Trasero", "Corona Trasera", "Juego de Piñón y Corona", "Palanca de Cambio", "Selector de Velocidades", "Amortiguador Delantero", "Amortiguador Trasero", "Resorte Delantero", "Resorte Trasero",
  "Aceite 10W-40", "Aceite 20W-50", "Aceite de Transmisión", "Grasa Multipropósito", "Líquido de Frenos", "Foco Delantero", "Foco Trasero", "Intermitente", "Regulador de Voltaje", "Alternador/Estator",
  "Bobina de Encendido", "CDI", "Arrancador Eléctrico", "Relay", "Cableado", "Diafragma de Carburador", "Jeringa de Carburador", "Flotador", "Válvula de Flotador", "Kit de Carburador",
  "Kit de Empaques", "Retén de Cigüeñal", "Anillo de Pistón", "Pistón", "Biela", "Cigüeñal", "Valvulas", "Taqué", "Empaque de Culata", "Junta de Cárter",
  "Cámara de Aire", "Cubierta Delantera", "Cubierta Trasera", "Válvula de Cámara", "Llanta", "Eje de Rueda", "Rodamiento", "Horquilla Delantera", "Tenedor", "Triple Árbol",
  "Manillar Completo", "Manubrio", "Puños", "Espejos", "Guardabarros", "Tanque de Combustible", "Asiento", "Porta Placa", "Soporte", "Parrilla",
  "Embrague Completo", "Plato de Embrague", "Discos de Embrague", "Resorte de Embrague", "Cable de Embrague", "Pedal de Cambio", "Pedal de Arranque", "Manija de Arranque", "Kit de Tornillos", "Tuerca de Seguridad"
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

  const count = 220;
  for (let i = 0; i < count; i++) {
    const name = baseItems[i % baseItems.length] + (i >= baseItems.length ? ` ${Math.floor(i / baseItems.length) + 1}` : "");
    const category = categories[rand(0, categories.length - 1)];
    const motorcycleModel = models[rand(0, models.length - 1)];
    const supplier = suppliers[rand(0, suppliers.length - 1)];
    const purchasePrice = rand(800, 45000);
    const margen = rand(40, 60);
    const stockBase = rand(0, 80);
    const minStock = rand(2, 15);
    const stock = stockBase === 0 ? rand(1, 5) : stockBase; // algunos bajos

    const code = await generateCode(name);
    await prisma.article.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        category,
        motorcycleModel,
        purchasePrice,
        salePrice: calculateSalePrice(purchasePrice, margen),
        stock,
        minStock,
        supplier,
      },
    });
  }

  console.log(`Seed FULL completo: admin/admin123, empleado/empleado123, ${count} artículos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
