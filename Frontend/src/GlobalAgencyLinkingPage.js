import React, { useState, useEffect } from 'react';
import { Building2, Link, Trash2, AlertCircle, CheckCircle, RefreshCw, Calendar } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const GlobalAgencyLinkingPage = ({ token }) => {
  const [unassignedAgents, setUnassignedAgents] = useState([]);
  const [agences, setAgences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkingAgent, setLinkingAgent] = useState(null);
  const [selectedAgence, setSelectedAgence] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
    loadAgences();
  }, []);

  const fetchWithAuth = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchWithAuth(`${API_URL}/global/unassigned-agents`);
      const data = await response.json();

      if (data.success) {
        setUnassignedAgents(data.unassignedAgents);
      } else {
        setError('Erreur chargement agents Global non assignés');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAgences = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/agences`);
      const data = await response.json();
      setAgences(data);
    } catch (err) {
      console.error('Erreur chargement agences:', err);
    }
  };

  const handleStartLinking = (agent) => {
    setLinkingAgent(agent);
    setSelectedAgence('');
    setNotes('');
    setError('');
    setSuccess('');

    // Pré-remplir les dates avec la période de l'agent
    if (agent.date_premiere_transaction) {
      const dateDebut = new Date(agent.date_premiere_transaction);
      setDateDebut(dateDebut.toISOString().split('T')[0]);
    }
    if (agent.date_derniere_transaction) {
      const dateFin = new Date(agent.date_derniere_transaction);
      setDateFin(dateFin.toISOString().split('T')[0]);
    }
  };

  const handleCancelLinking = () => {
    setLinkingAgent(null);
    setSelectedAgence('');
    setDateDebut('');
    setDateFin('');
    setNotes('');
  };

  const handleConfirmLink = async () => {
    if (!selectedAgence) {
      setError('Veuillez sélectionner une agence');
      return;
    }

    if (!dateDebut || !dateFin) {
      setError('Veuillez spécifier la période (date début et date fin)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchWithAuth(`${API_URL}/global/assign-agency`, {
        method: 'POST',
        body: JSON.stringify({
          agentUniqueId: linkingAgent.agent_unique_id,
          codeAgence: selectedAgence,
          dateDebut: dateDebut,
          dateFin: dateFin,
          notes: notes
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Agence ${selectedAgence} assignée avec succès! ${data.transactionsUpdated} transactions mises à jour.`);
        setLinkingAgent(null);
        setSelectedAgence('');
        setDateDebut('');
        setDateFin('');
        setNotes('');
        // Recharger les données
        await loadData();
      } else {
        setError(data.message || 'Erreur lors de l\'assignation');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && unassignedAgents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Building2 className="w-6 h-6 mr-2 text-blue-600" />
              Assignation Agences - Transactions Global
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Assignez manuellement les agents Global à leurs agences respectives pour chaque période
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Messages de feedback */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
          <span className="text-sm text-green-600">{success}</span>
        </div>
      )}

      {/* Liste des agents non assignés */}
      {unassignedAgents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Aucun agent Global non assigné
          </h3>
          <p className="text-gray-500">
            Tous les agents des transactions Global en attente ont été assignés à leurs agences.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Agents Global à assigner ({unassignedAgents.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {unassignedAgents.map(agent => (
              <div key={agent.agent_unique_id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">
                        {agent.agent_nom}
                      </h4>
                      <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                        EN ATTENTE
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <p>
                          <span className="font-medium">Codes:</span> {agent.codes || 'N/A'}
                        </p>
                        <p>
                          <span className="font-medium">Transactions:</span> {agent.nb_transactions || 0}
                        </p>
                      </div>
                      <div>
                        <p>
                          <span className="font-medium">Montant total:</span>{' '}
                          {new Intl.NumberFormat('fr-FR', {
                            style: 'currency',
                            currency: 'KMF',
                            minimumFractionDigits: 0
                          }).format(agent.montant_total || 0)}
                        </p>
                        <p>
                          <span className="font-medium">Période:</span>{' '}
                          {formatDate(agent.date_premiere_transaction)} - {formatDate(agent.date_derniere_transaction)}
                        </p>
                      </div>
                    </div>

                    {/* Interface d'assignation */}
                    {linkingAgent?.agent_unique_id === agent.agent_unique_id && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <Building2 className="inline w-4 h-4 mr-1" />
                              Agence :
                            </label>
                            <select
                              value={selectedAgence}
                              onChange={(e) => setSelectedAgence(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Choisir une agence --</option>
                              {agences.map(ag => (
                                <option key={ag.code_agence} value={ag.code_agence}>
                                  {ag.nom_agence} ({ag.code_agence})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="inline w-4 h-4 mr-1" />
                                Date début :
                              </label>
                              <input
                                type="date"
                                value={dateDebut}
                                onChange={(e) => setDateDebut(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date fin :
                              </label>
                              <input
                                type="date"
                                value={dateFin}
                                onChange={(e) => setDateFin(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (optionnel) :
                          </label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex: Agent temporaire, mission spéciale..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={handleConfirmLink}
                            disabled={loading || !selectedAgence || !dateDebut || !dateFin}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center"
                          >
                            <Link className="w-4 h-4 mr-2" />
                            Confirmer l'assignation
                          </button>
                          <button
                            onClick={handleCancelLinking}
                            disabled={loading}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bouton d'action */}
                  {linkingAgent?.agent_unique_id !== agent.agent_unique_id && (
                    <div className="ml-4">
                      <button
                        onClick={() => handleStartLinking(agent)}
                        disabled={loading}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
                      >
                        <Building2 className="w-4 h-4 mr-1" />
                        Assigner
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          <AlertCircle className="inline w-4 h-4 mr-1" />
          Comment ça fonctionne ?
        </h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Les fichiers Global contiennent des transactions de plusieurs agents de plusieurs agences mélangés</li>
          <li>• Chaque agent doit être manuellement assigné à son agence pour la période correspondante</li>
          <li>• Les dates sont pré-remplies selon la période des transactions de l'agent</li>
          <li>• Une fois assigné, les transactions de l'agent seront automatiquement liées à l'agence sélectionnée</li>
          <li>• Un agent peut avoir plusieurs assignations pour différentes périodes (s'il change d'agence)</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalAgencyLinkingPage;
