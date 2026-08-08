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

  app.get('/api/visitas/:petId', async (req: Request, res: Response) => {
    try {
      const { petId } = req.params;
      const viewingWallet = req.query.walletAddress as string; // Quién quiere ver

      // Llamada al contrato de Midnight pasando la wallet que consulta
      // El circuito ZK evaluará si 'viewingWallet' es el dueño o tiene permisos
      const visitas = await deployedContract.callRead.getVisits(
        petId.trim(),
        viewingWallet.trim()
      );

      res.json({ success: true, visitas });
    } catch (error: any) {
      // Si la wallet no tiene permisos, el contrato lanzará un error ZK o de aserción
      res.status(403).json({ 
        success: false, 
        error: "Acceso denegado: Tu wallet no tiene permisos ZK para ver este historial." 
      });
    }
  });

  app.listen(port, () => {
    console.log(`\n  🌐 Servidor Web de la Veterinaria activo en: http://localhost:${port}\n`);
  });
}