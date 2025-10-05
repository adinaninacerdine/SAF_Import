import React, { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, Calendar, User, FileText, Filter, Loader } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003/api';

const HistoryPage = ({ token }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    limit: 50
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', filters.limit);

      const response = await fetch(`${API_URL}/validation/imports/history?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Erreur récupération historique:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    fetchHistory();
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      startDate: '',
      endDate: '',
      limit: 50
    });
    setTimeout(fetchHistory, 100);
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

  const getStatusBadge = (status) => {
    if (status === 'VALIDE') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-4 h-4 mr-1" />
          Validé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
        <XCircle className="w-4 h-4 mr-1" />
        Rejeté
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <History className="w-6 h-6 mr-2 text-purple-600" />
            Historique des Imports et Validations
          </h2>

          {/* Filtres */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-3">
              <Filter className="w-5 h-5 mr-2 text-gray-600" />
              <h3 className="font-semibold text-gray-700">Filtres</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Tous</option>
                  <option value="VALIDE">Validés</option>
                  <option value="REJETE">Rejetés</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite</label>
                <select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Appliquer
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Résultats */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucun historique trouvé</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.import_session_id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                          {item.partenaire}
                        </span>
                        {getStatusBadge(item.statut_validation)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        Session: {item.import_session_id}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    {/* Informations d'import */}
                    <div className="border-r pr-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                        <FileText className="w-4 h-4 mr-1" />
                        Import
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="text-gray-600">Par:</span>
                          <span className="ml-2 font-medium">{item.import_user_id}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="text-gray-600">Le:</span>
                          <span className="ml-2 font-medium">{formatDate(item.import_date)}</span>
                        </div>
                        <div className="text-gray-600">
                          Période: <span className="font-medium">{formatDate(item.date_min)} - {formatDate(item.date_max)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Informations de validation */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                        {item.statut_validation === 'VALIDE' ? (
                          <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-1 text-red-600" />
                        )}
                        {item.statut_validation === 'VALIDE' ? 'Validation' : 'Rejet'}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="text-gray-600">Par:</span>
                          <span className="ml-2 font-medium">{item.validation_user_id}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="text-gray-600">Le:</span>
                          <span className="ml-2 font-medium">{formatDate(item.validation_date)}</span>
                        </div>
                        {item.commentaire && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs italic">
                            "{item.commentaire}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200 text-sm">
                    <div>
                      <span className="text-gray-600">Transactions:</span>
                      <span className="ml-2 font-semibold text-gray-800">{item.nb_transactions}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Montant total:</span>
                      <span className="ml-2 font-semibold text-gray-800">{formatAmount(item.montant_total)} KMF</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Montant moyen:</span>
                      <span className="ml-2 font-semibold text-gray-800">
                        {formatAmount(item.montant_total / item.nb_transactions)} KMF
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">📊 À propos de l'historique</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Cet historique affiche tous les imports validés ou rejetés</li>
            <li>• Les imports en attente sont visibles dans l'onglet "Validation"</li>
            <li>• Utilisez les filtres pour rechercher des imports spécifiques</li>
            <li>• Les données incluent qui a importé/validé et quand</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
