// test.js - Tester la connexion et les endpoints
const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${path}: Status ${res.statusCode}`);
        resolve(JSON.parse(data));
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('Test des endpoints...\n');
  
  try {
    // Test agences
    const agences = await testEndpoint('/api/agences');
    console.log(`   ${agences.length} agences trouvées`);
    
    // Test stats
    const stats = await testEndpoint('/api/dashboard/stats');
    console.log(`   Statistiques disponibles`);
    
    console.log('\n✅ Tous les tests passent!');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Attendre 2 secondes que le serveur démarre
setTimeout(runTests, 2000);