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

export async function registrarMascota(
  contract: any,
  datos: {
    id: string;
    nombre: string;
    especie: Species;
    raza: string;
    anioNacimiento: number;
  }
) {
  const petIdBytes = stringToBytes32(datos.id);
  const nombreBytes = stringToOpaque(datos.nombre);
  const razaBytes = stringToOpaque(datos.raza);

  // Invocación directa del circuito registerPet definido en Compact
  const tx = await contract.callTx.registerPet(
    petIdBytes,
    nombreBytes,
    datos.especie,
    razaBytes,
    BigInt(datos.anioNacimiento)
  );

  return tx;
}

export async function registrarVisita(
  contract: any,
  petId: string,
  notaDiagnostico: string
) {
  const petIdBytes = stringToBytes32(petId);
  const notaBytes = stringToOpaque(notaDiagnostico);

  // Invocación directa del circuito addVisit definido en Compact
  const tx = await contract.callTx.addVisit(petIdBytes, notaBytes);

  return tx;
}