/**
 * CLI para interactuar con el contrato de Veterinaria en Midnight
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// Importación estricta de tipos y valores desde el contrato compilado (usa index.d.ts automáticamente)
import type * as HelloWorldContract from '../contracts/managed/hello-world/contract/index.js';
import { Species } from '../contracts/managed/hello-world/contract/index.js';

import { startWebServer } from './server';

// @ts-expect-error Requerido para sincronización de billetera
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'helloWorldPrivateState';

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'hello-world');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('\n❌ ¡Contrato no compilado! Ejecuta: npm run compile\n');
  process.exit(1);
}

// Carga del módulo del contrato
const importedContract = await import(pathToFileURL(contractPath).href);
const HelloWorld = (importedContract.default ?? importedContract) as typeof HelloWorldContract;

const compiledContract = CompiledContract.make('hello-world', HelloWorld.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

// ─── Providers ─────────────────────────────────────────────────────────────────

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'hello-world-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main CLI ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Veterinaria UAI - CLI                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No hay despliegue para la red ${network}. Ejecuta \`npm run setup -- --network ${network}\` primero.`);
    process.exit(1);
  }
  console.log(`  Contrato: ${deployment.address}`);
  console.log(`  Red: ${network}\n`);

  try {
    const seed = SEED;

    console.log('  Conectando billetera...');
    const walletCtx = await createWallet({ network, networkConfig, seed });
    
    console.log('  Sincronizando con la red...');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Sincronizando... (${elapsed}s transcurridos)   `);
    }, 5000);
    await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Sincronizado con la red.                                             \n');

    await persistWalletState(network, walletCtx);
    const state = await walletCtx.wallet.waitForSyncedState();
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    const myAddress = walletCtx.unshieldedKeystore.getBech32Address().toString();

    console.log(`  Mi Dirección: ${myAddress}`);
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    console.log('  Conectando con el contrato...');
    const providers = await createProviders(walletCtx);

    const deployed = await findDeployedContract(providers, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
    });

    console.log('  ✅ ¡Conectado exitosamente!\n');

    let running = true;
    while (running) {
      console.log('─── Menú Veterinaria ───────────────────────────────────────────');
      console.log('  1. Registrar nueva mascota');
      console.log('  2. Registrar visita veterinaria');
      console.log('  3. Consultar saldo de billetera');
      console.log('  4. Iniciar Servidor Web (UAI HTTP)');
      console.log('  5. Salir\n');

      const choice = await rl.question('  Selecciona una opción: ');

      switch (choice.trim()) {
        case '1': {
          console.log('\n--- Inspeccionando Contract y deployed ---');
          console.log("Propiedades de HelloWorld.Contract:", Object.getOwnPropertyNames(HelloWorld.Contract));
          console.log("Prototipo de HelloWorld.Contract:", Object.getOwnPropertyNames(HelloWorld.Contract.prototype));
          console.log("Propiedades de deployed:", Object.keys(deployed));
          console.log('\n--- Registrar Mascota (Con Marshallers) ---');
          
          const petIdVal = "pet-test-01";
          const ownerVal = myAddress;
          const nameVal = "Firulais";
          const speciesVal = HelloWorld.Species.dog;
          const breedVal = "Labrador";
          const birthYearVal = 2022n;

          console.log('  Serializando parámetros y enviando transacción...');
          try {
            // Envolvemos cada parámetro con el marshaller correspondiente del contrato
            const tx = await deployed.callTx.registerPet(
              HelloWorld.marshallers.string.serialize(petIdVal),     // Para Opaque<"string">
              HelloWorld.marshallers.string.serialize(ownerVal),     // Para Opaque<"string">
              HelloWorld.marshallers.string.serialize(nameVal),      // Para Opaque<"string">
              speciesVal,                                            // El enum Species suele manejarse nativo o por su marshaller
              HelloWorld.marshallers.string.serialize(breedVal),     // Para Opaque<"string">
              HelloWorld.marshallers.Uint16.serialize(birthYearVal)  // Para Uint<16>
            );

            console.log(`\n  ✅ ¡Mascota registrada con éxito!`);
            console.log(`  ID Transacción: ${tx.public?.txId || (tx as any).txHash}\n`);
          } catch (error: any) {
            console.error('\n  ❌ Error al registrar con marshallers:');
            console.error(error);
          }
          break;
        }

        case '2': {
          console.log('\n--- Registrar Visita Veterinaria ---');
          const petId = await rl.question('  ID de la mascota (ej. pet-01): ');
          const note = await rl.question('  Diagnóstico / Vacuna / Indicaciones: ');

          console.log(`\n  Médico responsable: ${myAddress}`);
          console.log('  Generando ZK Proof y registrando visita (30-60s)...');

          try {
            const tx = await deployed.callTx.addVisit(
              petId.trim(),
              myAddress.trim(),
              note.trim()
            );

            console.log(`\n  ✅ Visita registrada con éxito por la wallet médica: ${myAddress}`);
            console.log(`  ID Transacción: ${tx.public?.txId || (tx as any).txHash}\n`);
          } catch (error) {
            console.error('\n  ❌ Error al registrar visita:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          console.log('\n  Consultando saldos...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  Dirección activa: ${myAddress}`);
          console.log(`  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST: ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '4': {
          console.log('\n  Iniciando Servidor Web HTTP...');
          startWebServer(deployed, 3000);
          break;
        }

        case '5':
          running = false;
          console.log('\n  👋 ¡Hasta luego!\n');
          break;

        default:
          console.log('\n  ❌ Opción no válida. Por favor ingresa un número del 1 al 5.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);