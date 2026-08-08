import * as express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrarMascota, registrarVisita } from './veterinaria-service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startWebServer(deployedContract: any, port = 3000) {
  // En sintaxis namespace ESM con @types/express se invoca así:
  const app = (express as any).default ? (express as any).default() : (express as any)();
  
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.post('/api/mascotas', async (req: Request, res: Response) => {
    try {
      const { id, ownerAddress, nombre, especie, raza, anioNacimiento, walletAddress } = req.body;
      const tx = await registrarMascota(deployedContract, {
        id,
        ownerAddress,
        nombre,
        especie,
        raza,
        anioNacimiento,
        walletAddress
      });
      res.json({ success: true, txId: tx.public.txId });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/visitas', async (req: Request, res: Response) => {
    try {
      const { petId, nota, walletAddress } = req.body;
      const tx = await registrarVisita(deployedContract, {
        petId,
        nota,
        walletAddress
      });
      res.json({ success: true, txId: tx.public.txId });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`\n  🌐 Servidor Web de la Veterinaria activo en: http://localhost:${port}\n`);
  });
}