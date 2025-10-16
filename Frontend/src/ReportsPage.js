// ReportsPage.js - Page de visualisation et téléchargement des rapports
import React, { useState, useEffect } from 'react';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  // États pour le formulaire de génération
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('excel'); // excel par défaut
  const [generateSuccess, setGenerateSuccess] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des rapports');
      }

      const data = await response.json();
      setReports(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/reports/download/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      // Créer un blob et déclencher le téléchargement
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReportType = (filename) => {
    if (filename.includes('MONEYGRAM')) return 'MoneyGram';
    if (filename.includes('RIA')) return 'RIA';
    if (filename.includes('GLOBAL')) return 'Global';
    if (filename.includes('agents_agences')) return 'Agents par agence';
    if (filename.includes('importes_application')) return 'Imports application';
    return 'Autre';
  };

  const getReportIcon = (filename) => {
    if (filename.endsWith('.xlsx')) return '📊';
    if (filename.endsWith('.csv')) return '📊';
    if (filename.endsWith('.pdf')) return '📄';
    if (filename.endsWith('.txt')) return '📝';
    return '📁';
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Veuillez sélectionner les dates de début et fin');
      return;
    }

    setGenerating(true);
    setError(null);
    setGenerateSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/rapports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dateDebut: startDate,
          dateFin: endDate,
          partenaire: selectedPartner || null,
          format: selectedFormat
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la génération');
      }

      const data = await response.json();

      setGenerateSuccess(`${data.rapports.length} rapport(s) généré(s) avec succès`);

      // Rafraîchir la liste des rapports après 1 seconde
      setTimeout(() => {
        loadReports();
      }, 1000);

    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement des rapports...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Rapports</h1>
        <p className="text-gray-600">Générez et téléchargez les rapports au format contrôleur</p>
      </div>

      {/* Formulaire de génération */}
      <div className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Générer un nouveau rapport</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Partenaire
            </label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les partenaires</option>
              <option value="RIA">RIA</option>
              <option value="MONEYGRAM">MoneyGram</option>
              <option value="GLOBAL">Global</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="excel">📊 Excel (.xlsx)</option>
              <option value="pdf">📄 PDF</option>
              <option value="txt">📝 Texte (.txt)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !startDate || !endDate}
              className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                generating || !startDate || !endDate
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {generating ? '⏳ Génération...' : '✨ Générer'}
            </button>
          </div>
        </div>

        {generateSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm">✅ {generateSuccess}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {reports.length} rapport(s) disponible(s)
        </div>
        <button
          onClick={loadReports}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          🔄 Actualiser
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">Aucun rapport disponible</p>
          <p className="text-gray-400 text-sm mt-2">
            Les rapports générés apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fichier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taille
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date de modification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{getReportIcon(report.filename)}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {report.filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {getReportType(report.filename)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(report.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(report.modified)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => downloadReport(report.filename)}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                      📥 Télécharger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Types de rapports disponibles:</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li><strong>MoneyGram / RIA / Global:</strong> Rapports au format contrôleur avec séparation agences principales et sous-agences</li>
          <li><strong>Formats disponibles:</strong> Excel (.xlsx), PDF ou Texte (.txt) avec colonnes (Code, Nom, Usager, Envois, Paiements, Annulations, Comm.)</li>
          <li><strong>Particularité Global:</strong> Les agents doivent être assignés manuellement avant génération du rapport</li>
        </ul>
      </div>
    </div>
  );
};

export default ReportsPage;
