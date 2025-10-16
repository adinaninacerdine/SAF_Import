import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Eye, AlertCircle, Loader } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const ValidationPage = ({ token }) => {
  const [pendingImports, setPendingImports] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [importDetails, setImportDetails] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPendingImports();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchPendingImports, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingImports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/validation/imports/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des imports');
      }

      const data = await response.json();
      setPendingImports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erreur lors de la récupération des imports');
      setPendingImports([]); // S'assurer que c'est un tableau
    } finally {
      setLoading(false);
    }
  };

  const fetchImportDetails = async (sessionId) => {
    setLoading(true);
    setError('');
    try {
      const [detailsRes, duplicatesRes] = await Promise.all([
        fetch(`${API_URL}/validation/imports/pending/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/validation/imports/duplicates/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const details = await detailsRes.json();
      const dups = await duplicatesRes.json();

      setImportDetails(Array.isArray(details) ? details : []);
      setDuplicates(Array.isArray(dups) ? dups : []);
      setSelectedImport(sessionId);
    } catch (err) {
      setError('Erreur lors de la récupération des détails');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (sessionId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir valider cet import ? Les transactions seront déplacées vers la table principale.')) {
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/validation/imports/validate/${sessionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commentaire })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ Import validé avec succès ! ${data.transactionsValidees} transactions importées.`);
        setCommentaire('');
        setSelectedImport(null);
        fetchPendingImports();
      } else {
        setError(data.error || 'Erreur lors de la validation');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (sessionId) => {
    const reason = window.prompt('Raison du rejet (optionnel):');
    if (reason === null) return; // Annuler

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/validation/imports/reject/${sessionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commentaire: reason || 'Import rejeté' })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ Import rejeté avec succès ! ${data.transactionsRejetees} transactions marquées comme rejetées.`);
        setSelectedImport(null);
        fetchPendingImports();
      } else {
        setError(data.error || 'Erreur lors du rejet');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <Clock className="w-6 h-6 mr-2 text-blue-600" />
            Imports en Attente de Validation
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
              <CheckCircle className="w-5 h-5 mr-2" />
              {success}
            </div>
          )}

          {loading && !selectedImport ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : pendingImports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucun import en attente de validation</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingImports.map((imp) => (
                <div
                  key={imp.import_session_id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                          {imp.partenaire}
                        </span>
                        <span className="text-gray-600 text-sm">
                          Importé par: <span className="font-medium">{imp.import_user_id}</span>
                        </span>
                        <span className="text-gray-600 text-sm ml-4">
                          {formatDate(imp.import_date)}
                        </span>
                      </div>
                      {imp.codes_agences && (
                        <div className="mb-2 flex items-center">
                          <span className="text-xs text-gray-600 mr-2">🏢 Codes agences:</span>
                          <div className="flex flex-wrap gap-1">
                            {imp.codes_agences.split(', ').map((code, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-mono font-semibold border border-blue-200">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Transactions:</span>
                          <span className="ml-2 font-semibold text-gray-800">{imp.nb_transactions}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Montant total:</span>
                          <span className="ml-2 font-semibold text-gray-800">{formatAmount(imp.montant_total)} KMF</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Agences:</span>
                          <span className="ml-2 font-semibold text-blue-600">{imp.nb_agences || 'Multiple'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Période:</span>
                          <span className="ml-2 font-semibold text-gray-800 text-xs">
                            {new Date(imp.date_min).toLocaleDateString('fr-FR')} - {new Date(imp.date_max).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => fetchImportDetails(imp.import_session_id)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Détails
                      </button>
                      <button
                        onClick={() => handleValidate(imp.import_session_id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center disabled:bg-gray-400"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Valider
                      </button>
                      <button
                        onClick={() => handleReject(imp.import_session_id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center disabled:bg-gray-400"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rejeter
                      </button>
                    </div>
                  </div>

                  {selectedImport === imp.import_session_id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {/* Alertes doublons */}
                      {duplicates.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-yellow-800 flex items-center">
                              <AlertCircle className="w-5 h-5 mr-2" />
                              ⚠️ {duplicates.length} doublon(s) détecté(s)
                            </h4>
                            <button
                              onClick={() => setShowDuplicates(!showDuplicates)}
                              className="text-sm text-yellow-700 hover:text-yellow-900 underline"
                            >
                              {showDuplicates ? 'Masquer' : 'Voir les détails'}
                            </button>
                          </div>
                          <p className="text-sm text-yellow-700">
                            Ces transactions existent déjà dans la base. Vérifiez avant de valider.
                          </p>

                          {showDuplicates && (
                            <div className="mt-4 space-y-3">
                              {duplicates.map((dup, idx) => (
                                <div key={idx} className="bg-white border border-yellow-300 rounded p-3">
                                  <div className="font-medium text-gray-900 mb-2">
                                    MTCN/PIN: {dup.CODEENVOI}
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="border-r pr-4">
                                      <p className="text-xs text-gray-500 mb-1">📥 Nouveau (fichier)</p>
                                      <p>💰 {formatAmount(dup.montant_nouveau)} KMF</p>
                                      <p>📅 {formatDate(dup.date_nouveau)}</p>
                                      <p>👤 {dup.agent_nouveau}</p>
                                      <p className="text-xs">📤 {dup.expediteur_nouveau}</p>
                                      <p className="text-xs">📥 {dup.beneficiaire_nouveau}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">✅ Existant (base)</p>
                                      <p>💰 {formatAmount(dup.montant_existant)} KMF</p>
                                      <p>📅 {formatDate(dup.date_existant)}</p>
                                      <p>👤 {dup.agent_existant}</p>
                                      <p className="text-xs">📤 {dup.expediteur_existant}</p>
                                      <p className="text-xs">📥 {dup.beneficiaire_existant}</p>
                                      <p className="text-xs text-blue-600">Importé: {formatDate(dup.date_import_existant)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Résumé par agence */}
                      {importDetails.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <span className="mr-2">🏢</span>
                            Répartition par Agence
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(() => {
                              // Grouper par code agence
                              const agenceGroups = importDetails.reduce((acc, trans) => {
                                const code = trans.CODEAGENCE || 'NON_SPECIFIE';
                                if (!acc[code]) {
                                  acc[code] = {
                                    code: code,
                                    nom: trans.nom_agence || 'Nom inconnu',
                                    count: 0,
                                    montant: 0,
                                    agents: new Set()
                                  };
                                }
                                acc[code].count++;
                                acc[code].montant += parseFloat(trans.MONTANT || 0);
                                if (trans.EFFECTUEPAR) {
                                  acc[code].agents.add(trans.EFFECTUEPAR);
                                }
                                return acc;
                              }, {});

                              return Object.values(agenceGroups).map((agence, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-blue-50 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="font-bold text-lg text-blue-700">{agence.code}</div>
                                      <div className="text-xs text-gray-600 truncate" title={agence.nom}>
                                        {agence.nom}
                                      </div>
                                    </div>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium ml-2">
                                      {agence.count} trans.
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-700 space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Montant:</span>
                                      <span className="font-semibold">{formatAmount(agence.montant)} KMF</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Agents:</span>
                                      <span className="font-semibold">{agence.agents.size}</span>
                                    </div>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Détails transactions */}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">Détails des transactions (100 premières)</h4>
                        {loading ? (
                          <div className="flex justify-center py-4">
                            <Loader className="w-6 h-6 animate-spin text-blue-600" />
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            {/* Tableau adaptatif selon le partenaire */}
                            {(() => {
                              // Déterminer le partenaire (on prend le premier de la liste ou depuis les détails)
                              const partner = imp.partenaire || (importDetails.length > 0 ? importDetails[0].PARTENAIRETRANSF : 'GLOBAL');

                              // Configuration des colonnes selon le partenaire
                              if (partner === 'RIA') {
                                // Colonnes spécifiques RIA
                                return (
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Numéro transfert</th>
                                        <th className="px-3 py-2 text-left">Date paiement</th>
                                        <th className="px-3 py-2 text-left">Bénéficiaire</th>
                                        <th className="px-3 py-2 text-center">Seq</th>
                                        <th className="px-3 py-2 text-center">Devise</th>
                                        <th className="px-3 py-2 text-right">Montant reçu</th>
                                        <th className="px-3 py-2 text-right">Taxe</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                        <th className="px-3 py-2 text-right">Commission</th>
                                        <th className="px-3 py-2 text-left">Agent</th>
                                        <th className="px-3 py-2 text-left">Agence</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {importDetails.map((trans, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 font-mono text-xs text-blue-600 font-bold">{trans.CODEENVOI}</td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(trans.DATEOPERATION)}</td>
                                          <td className="px-3 py-2 truncate max-w-[150px]" title={trans.NOMPRENOMBENEFICIAIRE}>
                                            {trans.NOMPRENOMBENEFICIAIRE}
                                          </td>
                                          <td className="px-3 py-2 text-center">{trans.NUMERO || '-'}</td>
                                          <td className="px-3 py-2 text-center text-xs">KMF</td>
                                          <td className="px-3 py-2 text-right font-medium">{formatAmount(trans.MONTANT)}</td>
                                          <td className="px-3 py-2 text-right">{formatAmount(trans.TAXES || 0)}</td>
                                          <td className="px-3 py-2 text-right font-bold">{formatAmount(trans.MONTANTTOTAL || trans.MONTANT)}</td>
                                          <td className="px-3 py-2 text-right text-green-600">{formatAmount(trans.COMMISSION || 0)}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center">
                                              <span className="truncate max-w-[100px]" title={trans.agent_nom_unifie || trans.EFFECTUEPAR}>
                                                {trans.agent_nom_unifie || trans.EFFECTUEPAR}
                                              </span>
                                              {trans.agent_nom_unifie && (
                                                <span className="ml-1 text-xs text-green-600" title="Agent unifié">✓</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
                                              {trans.CODEAGENCE || 'N/A'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else if (partner === 'MONEYGRAM') {
                                // Colonnes spécifiques MoneyGram
                                return (
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Heure et date</th>
                                        <th className="px-3 py-2 text-left">Num Réf</th>
                                        <th className="px-3 py-2 text-left">Type d'offre</th>
                                        <th className="px-3 py-2 text-left">ID utilisateur</th>
                                        <th className="px-3 py-2 text-center">ID point vente</th>
                                        <th className="px-3 py-2 text-right">Montant</th>
                                        <th className="px-3 py-2 text-right">Frais</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                        <th className="px-3 py-2 text-left">Agence</th>
                                        <th className="px-3 py-2 text-center">Type Op.</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {importDetails.map((trans, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(trans.DATEOPERATION)}</td>
                                          <td className="px-3 py-2 font-mono text-xs text-blue-600 font-bold">{trans.CODEENVOI}</td>
                                          <td className="px-3 py-2 text-xs truncate max-w-[120px]" title={trans.NOMPRENOMBENEFICIAIRE}>
                                            {trans.NOMPRENOMBENEFICIAIRE || trans.TYPEOPERATION || '-'}
                                          </td>
                                          <td className="px-3 py-2 truncate max-w-[100px]" title={trans.EFFECTUEPAR}>
                                            {trans.EFFECTUEPAR}
                                          </td>
                                          <td className="px-3 py-2 text-center text-xs">-</td>
                                          <td className="px-3 py-2 text-right font-medium">{formatAmount(trans.MONTANT)}</td>
                                          <td className="px-3 py-2 text-right text-orange-600">{formatAmount(trans.COMMISSION || 0)}</td>
                                          <td className="px-3 py-2 text-right font-bold">{formatAmount(trans.MONTANTTOTAL || trans.MONTANT)}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                              <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs text-center">
                                                {trans.CODEAGENCE || 'N/A'}
                                              </span>
                                              {trans.nom_agence && (
                                                <span className="text-xs text-gray-600 truncate mt-1" title={trans.nom_agence}>
                                                  {trans.nom_agence}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                              trans.TYPEOPERATION === 'ENVOI'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                              {trans.TYPEOPERATION || 'PAIEMENT'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              } else {
                                // Format par défaut (GLOBAL et autres)
                                return (
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Agence</th>
                                        <th className="px-3 py-2 text-left">Code Envoi</th>
                                        <th className="px-3 py-2 text-left">Expéditeur</th>
                                        <th className="px-3 py-2 text-left">Bénéficiaire</th>
                                        <th className="px-3 py-2 text-right">Montant</th>
                                        <th className="px-3 py-2 text-left">Agent</th>
                                        <th className="px-3 py-2 text-left">Date</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {importDetails.map((trans, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                              <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-center mb-1">
                                                {trans.CODEAGENCE || 'N/A'}
                                              </span>
                                              {trans.nom_agence && (
                                                <span className="text-xs text-gray-600 truncate max-w-[120px]" title={trans.nom_agence}>
                                                  {trans.nom_agence}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">{trans.CODEENVOI}</td>
                                          <td className="px-3 py-2 truncate max-w-[150px]" title={trans.NOMPRENOMEXPEDITEUR}>
                                            {trans.NOMPRENOMEXPEDITEUR}
                                          </td>
                                          <td className="px-3 py-2 truncate max-w-[150px]" title={trans.NOMPRENOMBENEFICIAIRE}>
                                            {trans.NOMPRENOMBENEFICIAIRE}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium">{formatAmount(trans.MONTANT)}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center">
                                              <span className="truncate max-w-[120px]" title={trans.agent_nom_unifie || trans.EFFECTUEPAR}>
                                                {trans.agent_nom_unifie || trans.EFFECTUEPAR}
                                              </span>
                                              {trans.agent_nom_unifie && (
                                                <span className="ml-1 text-xs text-green-600 flex-shrink-0" title="Agent unifié">✓</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(trans.DATEOPERATION)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Comment ça marche ?</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Les imports sont d'abord enregistrés dans une table temporaire</li>
            <li>• Vérifiez les détails en cliquant sur "Détails"</li>
            <li>• Cliquez sur "Valider" pour déplacer vers la base de production</li>
            <li>• Cliquez sur "Rejeter" pour annuler l'import</li>
            <li>• Les agents sont automatiquement unifiés (✓ = unifié)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ValidationPage;
