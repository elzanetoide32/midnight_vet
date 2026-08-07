import { resolveNetwork } from './network.ts';

async function test() {
  const { network, config: networkConfig } = resolveNetwork();
  console.log(`Probando conexión con el Indexer para la red "${network}"...`);
  console.log(`URL: ${networkConfig.indexer}`);

  try {
    const response = await fetch(networkConfig.indexer, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' })
    });

    console.log(`✅ ¡Conexión exitosa! El Indexer respondió con estado HTTP: ${response.status}`);
  } catch (error) {
    console.error('❌ Error: No se pudo conectar con el Indexer local.');
    console.error(error instanceof Error ? error.message : error);
  }
}

test().catch(console.error);