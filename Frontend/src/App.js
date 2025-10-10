import React, { useState, useEffect } from 'react';
import { Upload, Download, Users, FileText, TrendingUp, AlertCircle, CheckCircle, Lock, LogIn, LogOut, Shield, FileCheck, Building2, Clock, History } from 'lucide-react';
import ValidationPage from './ValidationPage';
import HistoryPage from './HistoryPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const LoginPage = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.token, data.user);
      } else {
        setError(data.error || 'Erreur de connexion');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">SAF Money Transfer</h2>
          <p className="text-gray-600 mt-2">Import Multi-Agences Sécurisé</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code Utilisateur
            </label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Ex: SAF2000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Votre mot de passe"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center"
          >
            {loading ? 'Connexion...' : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Se connecter
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <Shield className="inline w-3 h-3 mr-1" />
            Import multi-agences avec déduplication automatique
          </p>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('import');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedAgence, setSelectedAgence] = useState('MULTI');
  const [agences, setAgences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) verifyToken();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAgences();
    }
  }, [isAuthenticated]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const savedUser = JSON.parse(localStorage.getItem('user'));
        setUser(savedUser);
        setIsAuthenticated(true);
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const fetchWithAuth = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  const fetchAgences = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/agences`);
      const data = await response.json();
      setAgences(data);
    } catch (err) {
      console.error('Erreur chargement agences:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(fileExt)) {
        setError('Type de fichier non supporté');
        setSelectedFile(null);
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        setError('Fichier trop volumineux (max 100MB)');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setLoading(true);
    setError('');
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('agenceId', selectedAgence);
    formData.append('useValidation', 'true'); // Validation automatique
    if (selectedPartner) {
      formData.append('partnerName', selectedPartner);
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/import`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'import');
      }

      setImportResult(data);
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'KMF',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Shield className="w-6 h-6 mr-2 text-blue-600" />
                SAF Import System
              </h1>
              <p className="text-sm text-gray-500">Import multi-agences avec déduplication</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'ADMIN' && <span className="text-blue-600">Admin</span>}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs de navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('import')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                  activeTab === 'import'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </button>
              {user?.role === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setActiveTab('validation')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                      activeTab === 'validation'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Validation
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                      activeTab === 'history'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Historique
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>

        {/* Contenu selon l'onglet */}
        {activeTab === 'validation' && user?.role === 'ADMIN' ? (
          <ValidationPage token={token} />
        ) : activeTab === 'history' && user?.role === 'ADMIN' ? (
          <HistoryPage token={token} />
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <FileCheck className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold">Import Multi-Agences</h2>
            </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Partenaire (optionnel)
              </label>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Détection automatique</option>
                <option value="MONEYGRAM">MoneyGram</option>
                <option value="RIA">RIA</option>
                <option value="WESTERN_UNION">Western Union</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode d'import
              </label>
              <select
                value={selectedAgence}
                onChange={(e) => setSelectedAgence(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MULTI">
                  🏢 Toutes les agences (détection auto)
                </option>
                {agences.map(agence => (
                  <option key={agence.code_agence} value={agence.code_agence}>
                    {agence.nom_agence}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier à importer
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="mt-2 text-base text-gray-600">
                    {selectedFile ? selectedFile.name : 'Cliquez pour sélectionner un fichier'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Excel (.xlsx, .xls) ou CSV - Max 100MB
                  </span>
                  <input
                    id="fileInput"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {importResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-800">Import terminé!</h4>
                  <div className="mt-2 text-sm text-green-700">
                    <p>📊 Total: {importResult.totalRecords} lignes</p>
                    <p>✅ Importées: {importResult.successCount}</p>
                    <p>⚠️ Doublons: {importResult.duplicates}</p>
                    <p>💰 Montant: {formatCurrency(importResult.totalAmount)}</p>
                    
                    {importResult.agencesCount && (
                      <div className="mt-3 p-3 bg-blue-50 rounded">
                        <p className="font-medium text-blue-900 mb-2">
                          <Building2 className="inline w-4 h-4 mr-1" />
                          Répartition par agence ({importResult.agencesCount} agences)
                        </p>
                        {Object.entries(importResult.agencesSummary || {}).map(([code, stats]) => (
                          <div key={code} className="text-xs text-blue-800 ml-2">
                            {code} - {stats.name}: {stats.success} transactions ({formatCurrency(stats.amount)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleImport}
              disabled={loading || !selectedFile}
              className={`px-6 py-2 rounded-md text-white font-medium flex items-center ${
                loading || !selectedFile
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </>
              )}
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              <Shield className="inline w-4 h-4 mr-1" />
              Fonctionnalités
            </h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Import multi-agences avec détection automatique</li>
              <li>• Unification des agents (AMOUSSA001 = AMOUSSA002)</li>
              <li>• Détection des doublons de transactions</li>
              <li>• Support Western Union, MoneyGram, RIA</li>
            </ul>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default App;