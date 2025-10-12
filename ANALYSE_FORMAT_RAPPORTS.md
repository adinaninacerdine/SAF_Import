# Analyse Format Rapports - Corrections Nécessaires

## 📊 FORMAT ATTENDU (d'après vos exemples)

### Structure du rapport:

```
Résumé des transactions pour [PARTENAIRE] ([DD-MM-YYYY] --- [DD-MM-YYYY])         Devise: KMF

Agences MCTV
Code    Nom    Usager    Envois    Paiements    Annulations    Comm.
001     MCTV-SIEGE    RAOUDHOI ABDEREMANE    4280755    23184213    0    271780

Sous Agences
Code    Nom    Envois    Paiements    Annulations    Comm.
103     MCTV - HAMNAMALEVU    2039908    18582197    0    216754
```

---

## 🔍 DIFFÉRENCES IDENTIFIÉES

### 1. **Agences Principales vs Sous-Agences**

**Format attendu:**
- **Agences principales** (codes 001-020): Affichent l'**Usager** (nom agent)
- **Sous-agences** (codes >= 100): **PAS d'Usager**, agrégation par code agence uniquement

**Votre script actuel:**
- ❌ Ne distingue pas correctement les agences principales des sous-agences
- ❌ Utilise la même logique pour les deux

**Correction:**
```sql
-- Agences principales (001-020) : avec Usager
WHERE CAST(t.CODEAGENCE AS INT) >= 1 AND CAST(t.CODEAGENCE AS INT) <= 20
GROUP BY t.CODEAGENCE, a.DES_AGENCIA, am.agent_nom

-- Sous-agences (>= 100) : sans Usager, agrégé
WHERE CAST(t.CODEAGENCE AS INT) >= 100
GROUP BY t.CODEAGENCE, a.DES_AGENCIA
```

### 2. **Mapping des types d'opérations**

**D'après vos données, voici les TYPEOPERATION utilisés:**

| Votre BD | Catégorie rapport |
|---|---|
| ENVOI, ENVOI AGENCE, ENVOI AGENT | **Envois** |
| PAIEMENT, RECEPTION, RECEPTION AGENCE, RECEPTION AGENT, RECEPTIONS | **Paiements** |
| ANNULATION, ANNULATION AGENCE, ANNULATION AGENT | **Annulations** |

**Correction SQL:**
```sql
-- Envois
CASE WHEN t.TYPEOPERATION IN ('ENVOI', 'ENVOI AGENCE', 'ENVOI AGENT') THEN t.MONTANT ELSE 0 END

-- Paiements
CASE WHEN t.TYPEOPERATION IN ('PAIEMENT', 'RECEPTION', 'RECEPTION AGENCE', 'RECEPTION AGENT', 'RECEPTIONS') THEN t.MONTANT ELSE 0 END

-- Annulations
CASE WHEN t.TYPEOPERATION IN ('ANNULATION', 'ANNULATION AGENCE', 'ANNULATION AGENT') THEN t.MONTANT ELSE 0 END
```

### 3. **Particularité GLOBAL**

**Observation:** Dans vos exemples Global:
- ✅ Seulement des **Paiements** (pas d'Envois ni Annulations = 0)
- ✅ Commission = ~1% du montant payé

**Explication:** Global ne fait que des réceptions/paiements, jamais d'envois.

### 4. **Formatage des colonnes**

**Format attendu:** Espaces comme séparateurs (pas de TAB)
```
Code    Nom    Usager    Envois    Paiements    Annulations    Comm.
001     MCTV-SIEGE    RAOUDHOI ABDEREMANE    4280755    23184213    0    271780
```

**Votre script actuel:** Utilise TAB (`\t`)

**Correction:** Utiliser des espaces multiples pour alignement visuel

---

## ⚠️ PROBLÈMES DÉTECTÉS DANS VOS DONNÉES

### Problème 1: TYPEOPERATION manquant ou NULL

Si certaines transactions n'ont pas de `TYPEOPERATION` défini, elles ne seront pas comptées.

**Vérification nécessaire:**
```sql
SELECT
  PARTENAIRETRANSF,
  TYPEOPERATION,
  COUNT(*) as nb
FROM INFOSTRANSFERTPARTENAIRES
WHERE DATEOPERATION >= '2025-04-16'
  AND DATEOPERATION <= '2025-04-30'
GROUP BY PARTENAIRETRANSF, TYPEOPERATION
ORDER BY PARTENAIRETRANSF, TYPEOPERATION
```

### Problème 2: CODEAGENCE non numérique

Si certaines transactions ont un `CODEAGENCE` non convertible en INT (ex: 'MULTI', NULL), elles causent une erreur.

**Correction:**
```sql
WHERE TRY_CAST(t.CODEAGENCE AS INT) IS NOT NULL
  AND CAST(t.CODEAGENCE AS INT) >= 1
```

### Problème 3: Agents sans agence assignée (Global)

Les transactions Global importées avec `CODEAGENCE = NULL` ne peuvent pas être incluses dans les rapports.

**Solution:** Assigner les agences AVANT de générer le rapport.

---

## ✅ SCRIPT CORRIGÉ: generate-rapport-correct.js

### Améliorations apportées:

1. ✅ **Séparation agences principales / sous-agences**
   - Requête 1: Codes 001-020 avec Usager
   - Requête 2: Codes >= 100 sans Usager (agrégé)

2. ✅ **Mapping complet des TYPEOPERATION**
   - Envois: ENVOI, ENVOI AGENCE, ENVOI AGENT
   - Paiements: PAIEMENT, RECEPTION, RECEPTION AGENCE, RECEPTION AGENT, RECEPTIONS
   - Annulations: ANNULATION, ANNULATION AGENCE, ANNULATION AGENT

3. ✅ **Support des 3 partenaires**
   - RIA
   - MONEYGRAM
   - GLOBAL

4. ✅ **Format de sortie correct**
   - Espaces comme séparateurs
   - Colonnes alignées
   - Sections distinctes

5. ✅ **Gestion des dates**
   - Paramètres `dateDebut` et `dateFin`
   - Format: DD-MM-YYYY

---

## 📋 UTILISATION DU NOUVEAU SCRIPT

### Tester le script:

```bash
cd backend
node generate-rapport-correct.js
```

**Sortie attendue:**
```
📄 Génération rapport RIA...
   ✅ rapport_RIA_16042025_30042025.txt créé
   📊 15 lignes agences principales
   📊 29 sous-agences

📄 Génération rapport MONEYGRAM...
   ✅ rapport_MONEYGRAM_16042025_30042025.txt créé
   📊 16 lignes agences principales
   📊 27 sous-agences

📄 Génération rapport GLOBAL...
   ✅ rapport_GLOBAL_16042025_30042025.txt créé
   📊 14 lignes agences principales
   📊 25 sous-agences
```

### Personnaliser les dates:

Dans le script, modifier:
```javascript
const dateDebut = new Date('2025-04-16');
const dateFin = new Date('2025-04-30');
```

### Générer un seul partenaire:

```javascript
// Au lieu de:
generateRapportControleur(dateDebut, dateFin);

// Utiliser:
generateRapportControleur(dateDebut, dateFin, 'RIA');
```

---

## 🔄 INTÉGRATION DANS L'API

Pour intégrer ce format dans votre API `/api/reports`, créer une route:

```javascript
// Dans server.js ou reports-routes.js
router.get('/api/reports/controleur', authMiddleware, async (req, res) => {
  try {
    const { dateDebut, dateFin, partenaire } = req.query;

    // Validation
    if (!dateDebut || !dateFin) {
      return res.status(400).json({ error: 'Dates manquantes' });
    }

    // Générer rapport (logique du script)
    const rapport = await generateRapportControleur(
      new Date(dateDebut),
      new Date(dateFin),
      partenaire || null
    );

    // Retourner le fichier
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport_${partenaire || 'ALL'}_${dateDebut}_${dateFin}.txt"`);
    res.send(rapport);

  } catch (error) {
    console.error('Erreur génération rapport:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🧪 TESTS À EFFECTUER

### Test 1: Vérifier les TYPEOPERATION

```bash
cd backend
node -e "
const sql = require('mssql');
require('dotenv').config();
(async () => {
  const pool = await sql.connect({
    server: 'localhost',
    database: 'SAF_MCTV_COMORES',
    user: 'sa',
    password: 'Admin@123',
    options: { encrypt: false, trustServerCertificate: true }
  });

  const r = await pool.request().query(\`
    SELECT DISTINCT TYPEOPERATION, PARTENAIRETRANSF, COUNT(*) as nb
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE DATEOPERATION >= '2025-04-16' AND DATEOPERATION <= '2025-04-30'
    GROUP BY TYPEOPERATION, PARTENAIRETRANSF
    ORDER BY PARTENAIRETRANSF, TYPEOPERATION
  \`);

  r.recordset.forEach(row => {
    console.log(\`\${row.PARTENAIRETRANSF}: \${row.TYPEOPERATION} (\${row.nb} trans)\`);
  });

  await pool.close();
})();
"
```

### Test 2: Vérifier la répartition agences principales / sous-agences

```bash
node -e "
const sql = require('mssql');
require('dotenv').config();
(async () => {
  const pool = await sql.connect({
    server: 'localhost',
    database: 'SAF_MCTV_COMORES',
    user: 'sa',
    password: 'Admin@123',
    options: { encrypt: false, trustServerCertificate: true }
  });

  const r = await pool.request().query(\`
    SELECT
      CASE
        WHEN CAST(CODEAGENCE AS INT) >= 1 AND CAST(CODEAGENCE AS INT) <= 20 THEN 'Agence principale'
        WHEN CAST(CODEAGENCE AS INT) >= 100 THEN 'Sous-agence'
        ELSE 'Autre'
      END as Type,
      COUNT(*) as nb_transactions
    FROM INFOSTRANSFERTPARTENAIRES
    WHERE DATEOPERATION >= '2025-04-16'
      AND DATEOPERATION <= '2025-04-30'
      AND TRY_CAST(CODEAGENCE AS INT) IS NOT NULL
    GROUP BY
      CASE
        WHEN CAST(CODEAGENCE AS INT) >= 1 AND CAST(CODEAGENCE AS INT) <= 20 THEN 'Agence principale'
        WHEN CAST(CODEAGENCE AS INT) >= 100 THEN 'Sous-agence'
        ELSE 'Autre'
      END
  \`);

  r.recordset.forEach(row => {
    console.log(\`\${row.Type}: \${row.nb_transactions} transactions\`);
  });

  await pool.close();
})();
"
```

### Test 3: Générer les rapports

```bash
cd backend
node generate-rapport-correct.js
```

Puis vérifier les fichiers générés:
- `rapport_RIA_16042025_30042025.txt`
- `rapport_MONEYGRAM_16042025_30042025.txt`
- `rapport_GLOBAL_16042025_30042025.txt`

---

## 📝 PROCHAINES ÉTAPES

1. ✅ **Tester le nouveau script** avec vos données réelles
2. ✅ **Vérifier que les montants correspondent** à vos exemples
3. ✅ **Intégrer dans l'API** pour génération depuis l'interface
4. ✅ **Ajouter export Excel** (optionnel, en plus du TXT)
5. ✅ **Gérer Western Union** une fois le format PDF/CSV disponible

---

**Date**: 2025-10-12
**Version**: 1.0
**Auteur**: Analyse technique format rapports
