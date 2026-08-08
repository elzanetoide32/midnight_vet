import { Buffer } from 'node:buffer';

// Definición de las especies para mapear al Enum del contrato
export enum Species {
  Dog = 0,
  Cat = 1,
  Bird = 2,
  Rabbit = 3,
  Other = 4,
}

// Auxiliar para convertir strings a Uint8Array de 32 bytes (para petId)
export function stringToBytes32(text: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(text);
  bytes.set(encoded.slice(0, 32));
  return bytes;
}

// Auxiliar para convertir strings a Uint8Array (para Opaque<"string">)
export function stringToOpaque(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ─── Lógica para llamar a los circuitos de tu contrato ───────────────────────

export async function registrarMascota(deployedContract: any, data: any) {
  // Si no puso nada en ownerAddress, usamos la wallet del doctor o la que venga por defecto
  const owner = data.ownerAddress && data.ownerAddress.trim() !== "" 
    ? data.ownerAddress.trim() 
    : data.walletAddress; // Wallet de quien está ejecutando la sesión

  const tx = await deployedContract.callTx.registerPet(
    data.id.trim(),
    owner,
    data.nombre.trim(),
    Number(data.especie),
    data.raza.trim(),
    String(data.anioNacimiento) // String plano para Opaque<"string">
  );

  return tx;
}


export async function registrarVisita(deployedContract: any, data: any) {
  const tx = await deployedContract.callTx.addVisit(
    data.petId.trim(),
    data.walletAddress.trim(), // La wallet del médico logueado (myAddress)
    data.nota.trim()
  );
  return tx;
}