const sql = require('mssql');

async function checkLocalSQL() {
  console.log('🔍 Vérification SQL Server local...\n');

  const config = {
    server: 'localhost\\MCTVTEST',
    database: 'master',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    authentication: {
      type: 'default',
      options: {
        userName: 'sa',
        password: 'Comoros@2024'
      }
    }
  };

  try {
    console.log('Tentative de connexion à: localhost\\MCTVTEST');
    const pool = await sql.connect(config);
    console.log('✅ Connecté au SQL Server local!\n');

    // Lister les bases de données
    const databases = await pool.request().query(`
      SELECT name FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);

    console.log('📊 Bases de données trouvées:');
    databases.recordset.forEach(db => {
      console.log(`   - ${db.name}`);
    });

    // Vérifier si SAF_MCTV_COMORES existe
    const hasDB = databases.recordset.some(db => db.name === 'SAF_MCTV_COMORES');

    if (hasDB) {
      console.log('\n✅ La base SAF_MCTV_COMORES existe!');

      // Se connecter à cette base
      await pool.close();
      config.database = 'SAF_MCTV_COMORES';
      const pool2 = await sql.connect(config);

      const count = await pool2.request().query(`
        SELECT COUNT(*) as total FROM INFOSTRANSFERTPARTENAIRES
      `);

      console.log(`   📈 Transactions: ${count.recordset[0].total}`);

      await pool2.close();
    } else {
      console.log('\n⚠️  La base SAF_MCTV_COMORES n\'existe pas encore.');
      console.log('   Il faut la restaurer depuis le backup.');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n💡 Solutions possibles:');
    console.log('   1. Vérifier que SQL Server est démarré');
    console.log('   2. Vérifier le nom de l\'instance: localhost\\MCTVTEST');
    console.log('   3. Vérifier les credentials');
  }
}

checkLocalSQL();
