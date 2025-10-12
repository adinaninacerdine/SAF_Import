import React, { useState, useEffect } from 'react';
import { Users, Link, Trash2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const UnknownAgentsPage = ({ token }) => {
  const [unknownAgents, setUnknownAgents] = useState([]);
  const [knownAgents, setKnownAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkingAgent, setLinkingAgent] = useState(null);
  const [selectedTargetAgent, setSelectedTargetAgent] = useState('');

  useEffect(() => {
    loadData();
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
      // Charger agents inconnus et agents connus en parallèle
      const [unknownRes, knownRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/agents/unknown`),
        fetchWithAuth(`${API_URL}/agents/known`)
      ]);

      const unknownData = await unknownRes.json();
      const knownData = await knownRes.json();

      if (unknownData.success) {
        setUnknownAgents(unknownData.unknownAgents);
      } else {
        setError('Erreur chargement agents inconnus');
      }

      if (knownData.success) {
        setKnownAgents(knownData.knownAgents);
      } else {
        setError('Erreur chargement agents connus');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLinking = (agent) => {
    setLinkingAgent(agent);
    setSelectedTargetAgent('');
    setError('');
    setSuccess('');
  };

  const handleCancelLinking = () => {
    setLinkingAgent(null);
    setSelectedTargetAgent('');
  };

  const handleConfirmLink = async () => {
    if (!selectedTargetAgent) {
      setError('Veuillez sélectionner un agent cible');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Extraire le premier code de la liste des codes
      const codes = linkingAgent.codes.split(', ');
      const codeUser = codes[0];

      const response = await fetchWithAuth(`${API_URL}/agents/link`, {
        method: 'POST',
        body: JSON.stringify({
          codeUser: codeUser,
          targetAgentId: parseInt(selectedTargetAgent)
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Code ${codeUser} lié avec succès!`);
        setLinkingAgent(null);
        setSelectedTargetAgent('');
        // Recharger les données
        await loadData();
      } else {
        setError(data.message || 'Erreur lors de la liaison');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet agent inconnu?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchWithAuth(`${API_URL}/agents/unknown/${agentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Agent supprimé avec succès');
        await loadData();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && unknownAgents.length === 0) {
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
              <Users className="w-6 h-6 mr-2 text-blue-600" />
              Gestion des Codes Agents Inconnus
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Liez les codes agents provenant des fichiers partenaires aux agents existants
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

      {/* Liste des agents inconnus */}
      {unknownAgents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Aucun agent inconnu
          </h3>
          <p className="text-gray-500">
            Tous les codes agents sont liés à des agents existants.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Codes agents à lier ({unknownAgents.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {unknownAgents.map(agent => (
              <div key={agent.agent_unique_id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">
                        {agent.agent_nom}
                      </h4>
                      <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                        INCONNU
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Codes:</span> {agent.codes || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">Transactions:</span> {agent.nb_transactions || 0}
                      </p>
                      <p>
                        <span className="font-medium">Montant total:</span>{' '}
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'KMF',
                          minimumFractionDigits: 0
                        }).format(agent.montant_total || 0)}
                      </p>
                    </div>

                    {/* Interface de liaison */}
                    {linkingAgent?.agent_unique_id === agent.agent_unique_id && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sélectionnez l'agent cible :
                        </label>
                        <select
                          value={selectedTargetAgent}
                          onChange={(e) => setSelectedTargetAgent(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                        >
                          <option value="">-- Choisir un agent --</option>
                          {knownAgents.map(ka => (
                            <option key={ka.agent_unique_id} value={ka.agent_unique_id}>
                              {ka.agent_nom} ({ka.codes})
                            </option>
                          ))}
                        </select>

                        <div className="flex space-x-2">
                          <button
                            onClick={handleConfirmLink}
                            disabled={loading || !selectedTargetAgent}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center"
                          >
                            <Link className="w-4 h-4 mr-2" />
                            Confirmer
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

                  {/* Actions */}
                  {linkingAgent?.agent_unique_id !== agent.agent_unique_id && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleStartLinking(agent)}
                        disabled={loading}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
                      >
                        <Link className="w-4 h-4 mr-1" />
                        Lier
                      </button>
                      <button
                        onClick={() => handleDelete(agent.agent_unique_id)}
                        disabled={loading}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center"
                      >
                        <Trash2 className="w-4 h-4" />
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
          <li>• Les codes inconnus proviennent des fichiers partenaires (ex: MRAIZ00 dans MoneyGram)</li>
          <li>• Cliquez sur "Lier" pour associer un code inconnu à un agent existant</li>
          <li>• Les transactions liées au code seront automatiquement attribuées à l'agent choisi</li>
          <li>• Vous pouvez supprimer un code inconnu s'il n'est pas pertinent</li>
        </ul>
      </div>
    </div>
  );
};

export default UnknownAgentsPage;
