# Rapports Améliorés - Format Contrôleur

## ✅ AMÉLIORATIONS APPORTÉES

### 1. Nouvelle Route API de Génération

**Endpoint:** `POST /api/rapports/generate`

**Authentification:** Requiert JWT token (Bearer)

**Body (JSON):**
```json
{
  "dateDebut": "2025-04-16",
  "dateFin": "2025-04-30",
  "partenaire": "RIA"  // ou "MONEYGRAM", "GLOBAL", null pour tous
}
```

**Réponse:**
```json
{
  "success": true,
  "rapports": [
    {
      "filename": "rapport_RIA_16042025_30042025.txt",
      "partenaire": "RIA",
      "lignesAgencesPrincipales": 8,
      "lignesSousAgences": 15
    }
  ],
  "message": "1 rapport(s) généré(s) avec succès"
}
```

### 2. Format Exact du Contrôleur

**Structure:**
```
Résumé des transactions pour [PARTENAIRE] (DD-MM-YYYY --- DD-MM-YYYY)         Devise: KMF

Agences MCTV
Code    Nom    Usager    Envois    Paiements    Annulations    Comm.
001     MCTV-SIEGE    RAOUDHOI ABDEREMANE    4280755    23184213    0    271780

Sous Agences
Code    Nom    Envois    Paiements    Annulations    Comm.
103     MCTV - HAMNAMALEVU    2039908    18582197    0    216754
```

### 3. Logique Corrigée

#### Distinction Agences Principales / Sous-Agences

**Agences Principales (001-020):**
- Affichent le nom de l'**Usager** (agent)
- Groupées par Code Agence + Agent
- Colonnes: Code, Nom, Usager, Envois, Paiements, Annulations, Comm.

**Sous-Agences (≥100):**
- **PAS d'Usager** affiché
- Agrégées par Code Agence uniquement
- Colonnes: Code, Nom, Envois, Paiements, Annulations, Comm.

#### Mapping TYPEOPERATION

**Envois:**
- `ENVOI`
- `ENVOI AGENCE`
- `ENVOI AGENT`

**Paiements:**
- `PAIEMENT`
- `RECEPTION`
- `RECEPTION AGENCE`
- `RECEPTION AGENT`
- `RECEPTIONS`

**Annulations:**
- `ANNULATION`
- `ANNULATION AGENCE`
- `ANNULATION AGENT`

#### Gestion Agents Non Assignés

**Transactions avec AGENT_UNIQUE_ID = NULL:**
- Affichent "NON ASSIGNÉ" dans la colonne Usager
- Cas typique: anciennes données du système Abbas
- Pour Global: jusqu'à l'assignation manuelle via l'onglet Global Agences

### 4. Requêtes SQL Optimisées

**Agences Principales:**
```sql
SELECT
  t.CODEAGENCE as Code,
  a.DES_AGENCIA as Nom,
  COALESCE(am.agent_nom, 'NON ASSIGNÉ') as Usager,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('ENVOI', 'ENVOI AGENCE', 'ENVOI AGENT')
    THEN t.MONTANT ELSE 0 END), 0) as Envois,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('PAIEMENT', 'RECEPTION', ...)
    THEN t.MONTANT ELSE 0 END), 0) as Paiements,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('ANNULATION', ...)
    THEN t.MONTANT ELSE 0 END), 0) as Annulations,
  ISNULL(SUM(t.COMMISSION), 0) as Comm
FROM INFOSTRANSFERTPARTENAIRES t
LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
LEFT JOIN tm_agent_mapping am ON t.AGENT_UNIQUE_ID = am.agent_unique_id
WHERE t.PARTENAIRETRANSF = @partenaire
  AND t.DATEOPERATION >= @dateDebut
  AND t.DATEOPERATION <= @dateFin
  AND CAST(t.CODEAGENCE AS INT) >= 1
  AND CAST(t.CODEAGENCE AS INT) <= 20
GROUP BY t.CODEAGENCE, a.DES_AGENCIA, am.agent_nom
ORDER BY CAST(t.CODEAGENCE AS INT), am.agent_nom
```

**Sous-Agences (agrégées):**
```sql
SELECT
  t.CODEAGENCE as Code,
  a.DES_AGENCIA as Nom,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('ENVOI', ...) THEN t.MONTANT ELSE 0 END), 0) as Envois,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('PAIEMENT', ...) THEN t.MONTANT ELSE 0 END), 0) as Paiements,
  ISNULL(SUM(CASE WHEN t.TYPEOPERATION IN ('ANNULATION', ...) THEN t.MONTANT ELSE 0 END), 0) as Annulations,
  ISNULL(SUM(t.COMMISSION), 0) as Comm
FROM INFOSTRANSFERTPARTENAIRES t
LEFT JOIN CF.CF_AGENCIAS a ON t.CODEAGENCE = a.COD_AGENCIA
WHERE t.PARTENAIRETRANSF = @partenaire
  AND t.DATEOPERATION >= @dateDebut
  AND t.DATEOPERATION <= @dateFin
  AND CAST(t.CODEAGENCE AS INT) >= 100
GROUP BY t.CODEAGENCE, a.DES_AGENCIA
ORDER BY CAST(t.CODEAGENCE AS INT)
```

---

## 📁 FICHIERS CRÉÉS/MODIFIÉS

### Nouveau fichier backend:
- ✅ **`backend/reports-routes.js`** - Module Express pour génération rapports

### Modifications:
- ✅ **`backend/server.js`** - Ajout import + route `/api/rapports`

### Scripts utilitaires:
- ✅ **`backend/generate-rapport-correct.js`** - Script standalone pour tests

### Documentation:
- ✅ **`ANALYSE_FORMAT_RAPPORTS.md`** - Analyse détaillée du format
- ✅ **`RAPPORTS_AMELIORES.md`** - Ce document

---

## 🧪 TESTS

### Test 1: Générer rapport RIA pour avril 2025

**Requête cURL:**
```bash
curl -X POST http://localhost:3001/api/rapports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "dateDebut": "2025-04-16",
    "dateFin": "2025-04-30",
    "partenaire": "RIA"
  }'
```

**Réponse attendue:**
```json
{
  "success": true,
  "rapports": [
    {
      "filename": "rapport_RIA_16042025_30042025.txt",
      "partenaire": "RIA",
      "lignesAgencesPrincipales": 8,
      "lignesSousAgences": 15
    }
  ],
  "message": "1 rapport(s) généré(s) avec succès"
}
```

**Fichier généré:**
```
C:\SAF_Import\backend\rapport_RIA_16042025_30042025.txt
```

### Test 2: Générer tous les rapports (RIA, MONEYGRAM, GLOBAL)

**Requête:**
```json
{
  "dateDebut": "2025-04-16",
  "dateFin": "2025-04-30",
  "partenaire": null
}
```

**Fichiers générés:**
- `rapport_RIA_16042025_30042025.txt`
- `rapport_MONEYGRAM_16042025_30042025.txt`
- `rapport_GLOBAL_16042025_30042025.txt`

### Test 3: Script standalone

**Commande:**
```bash
cd backend
node generate-rapport-correct.js
```

**Sortie:**
```
📊 Génération rapport RIA...
   ✅ rapport_RIA_16042025_30042025.txt créé
   📊 8 lignes agences principales
   📊 15 sous-agences
   💰 Paiements: 48 937 665 KMF
```

---

## 🔄 INTÉGRATION FRONTEND

### Modification de ReportsPage.js

**Ajouter bouton de génération:**
```javascript
const handleGenerateReport = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/rapports/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        dateDebut: startDate,
        dateFin: endDate,
        partenaire: selectedPartner || null
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`${data.rapports.length} rapport(s) généré(s) avec succès!`);
      // Rafraîchir la liste des rapports
      fetchReports();
    }
  } catch (error) {
    console.error('Erreur génération:', error);
    alert('Erreur lors de la génération du rapport');
  }
};
```

**Bouton dans le render:**
```jsx
<button
  onClick={handleGenerateReport}
  className="btn btn-primary"
  disabled={!startDate || !endDate}
>
  Générer Rapport
</button>
```

---

## ⚠️ POINTS D'ATTENTION

### 1. Transactions Sans Agent (NON ASSIGNÉ)

**Problème identifié:**
- 387 transactions RIA dans la base ont `AGENT_UNIQUE_ID = NULL`
- Proviennent probablement du système Abbas (avant déduplication)

**Solutions:**

**Option A: Exclure du rapport**
```sql
WHERE t.AGENT_UNIQUE_ID IS NOT NULL  -- Ajouter cette condition
```

**Option B: Afficher "NON ASSIGNÉ"** (solution actuelle)
```sql
COALESCE(am.agent_nom, 'NON ASSIGNÉ') as Usager
```

**Option C: Script de correction**
```javascript
// Assigner rétroactivement un agent_unique_id basé sur EFFECTUEPAR
const corrections = await pool.request().query(`
  UPDATE t
  SET t.AGENT_UNIQUE_ID = am.agent_unique_id
  FROM INFOSTRANSFERTPARTENAIRES t
  INNER JOIN tm_agent_codes ac ON t.EFFECTUEPAR = ac.code_user
  INNER JOIN tm_agent_mapping am ON ac.agent_unique_id = am.agent_unique_id
  WHERE t.AGENT_UNIQUE_ID IS NULL
    AND t.EFFECTUEPAR IS NOT NULL
`);
```

### 2. Global - Agents Non Assignés

**Comportement:**
- Les transactions Global importées ont `CODEAGENCE = NULL` initialement
- Elles apparaissent comme "NON ASSIGNÉ" jusqu'à l'assignation manuelle
- Après assignation via l'onglet "Global Agences", elles auront un CODEAGENCE

**Workflow:**
1. Import Global → CODEAGENCE = NULL
2. Onglet "Global Agences" → Assignation manuelle
3. Mise à jour CODEAGENCE → Apparaît dans les rapports

### 3. Performance

**Pour périodes longues (> 3 mois):**
- Ajouter index sur `DATEOPERATION`:
  ```sql
  CREATE INDEX IX_INFOSTRANSFERTPARTENAIRES_DATEOPERATION
  ON INFOSTRANSFERTPARTENAIRES(DATEOPERATION)
  INCLUDE (PARTENAIRETRANSF, CODEAGENCE, MONTANT, COMMISSION)
  ```

- Augmenter le timeout dans `reports-routes.js`:
  ```javascript
  pool: {
    requestTimeout: 120000  // 2 minutes
  }
  ```

---

## 📊 EXEMPLES DE RAPPORTS GÉNÉRÉS

### RIA - Agences Principales
```
Code    Nom    Usager    Envois    Paiements    Annulations    Comm.
001     MCTV-SIEGE    RAOUDHOI ABDEREMANE    0    40456483    0    0
001     MCTV-SIEGE    FATIMA AHMED    0    6357440    0    0
002     MCTV-ANJOUAN    CHOUANYIBOU SOUFIANE    0    2493517    0    0
```

### MoneyGram - Sous-Agences
```
Code    Nom    Envois    Paiements    Annulations    Comm.
103     MCTV - HAMNAMALEVU    1865783    7903291    0    10562
105     MCTV - F.D.M    0    2500448    0    0
106     MCTV - CJAP    2499240    1855227    636325    27242
```

### Global - Particularité (Paiements uniquement)
```
Code    Nom    Usager    Envois    Paiements    Annulations    Comm.
001     MCTV-SIEGE    RAOUDHOI ABDEREMANE    0    4788439    0    47892
004     MCTV-PHILIPS    SOULAIMANA ISMAEL    0    10851679    0    108537
```

---

## 🚀 DÉPLOIEMENT EN PRODUCTION

### Étape 1: Vérifier le backend

```bash
cd backend
npm start
```

**Vérifier console:**
```
✅ Connecté à SQL Server
✅ Service de déduplication prêt
╔════════════════════════════════════════╗
║      SAF IMPORT - SERVEUR SÉCURISÉ     ║
║  ✅ Port: 3001                      ║
╚════════════════════════════════════════╝
```

### Étape 2: Tester l'API

```bash
# Récupérer un token JWT
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"SAF001","password":"yourpassword"}'

# Utiliser le token pour générer un rapport
curl -X POST http://localhost:3001/api/rapports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"dateDebut":"2025-04-16","dateFin":"2025-04-30","partenaire":"RIA"}'
```

### Étape 3: Intégrer dans le frontend

Voir section "Intégration Frontend" ci-dessus.

### Étape 4: Formation utilisateurs

**Points clés:**
1. Sélectionner les dates de début/fin
2. Choisir le partenaire (ou "Tous")
3. Cliquer sur "Générer Rapport"
4. Télécharger le fichier .txt généré
5. Les rapports sont au format contrôleur attendu

---

## 📝 CHECKLIST DE VALIDATION

- [ ] Backend démarre sans erreur
- [ ] Route `/api/rapports/generate` accessible
- [ ] Génération RIA fonctionne
- [ ] Génération MONEYGRAM fonctionne
- [ ] Génération GLOBAL fonctionne
- [ ] Format de sortie conforme aux exemples
- [ ] Agents non assignés affichent "NON ASSIGNÉ"
- [ ] Séparation agences principales / sous-agences correcte
- [ ] Mapping TYPEOPERATION complet (Envois/Paiements/Annulations)
- [ ] Téléchargement des fichiers .txt fonctionne
- [ ] Frontend intégré et testé

---

**Date:** 2025-10-12
**Version:** 1.0
**Auteur:** Amélioration système de rapports
