import React, { useState, useEffect } from 'react';
import { Upload, FileText, Database, CheckCircle, AlertCircle, RefreshCw, Eye, Download, BarChart3, Clock, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressIndicator } from '../ui/ProgressIndicator';
import { cn } from '../../utils/cn';

interface DataPoint {
  tagName: string;
  dateTime: string;
  value: number;
  quality: number;
}

interface InspectionData {
  tagName: string;
  rowCount: number;
  startTime: string;
  endTime: string;
  sampleData: DataPoint[];
  allDataPoints: DataPoint[];
  sqlPreview: string;
}

export const DataManagement: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<string>('csv');
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionData | null>(null);
  const [executing, setExecuting] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  // Poll for progress if operationId is set
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (operationId && executing) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/progress/${operationId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
          });
          const data = await response.json();

          if (data) {
            setProgress(data.progress || 0);
            setProgressMessage(data.message || '');

            if (data.stage === 'completed') {
              setExecuting(false);
              setOperationId(null);
              setSuccess(data.message);
              setInspectionResult(null);
              setFiles([]);
            } else if (data.stage === 'failed') {
              setExecuting(false);
              setOperationId(null);
              setError(data.message);
            }
          }
        } catch (err) {
          console.error('Error polling progress:', err);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [operationId, executing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setInspectionResult(null);
      setError(null);
      setSuccess(null);
    }
  };

  const handleInspect = async () => {
    if (files.length === 0) return;

    setInspecting(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('type', type);

    try {
      const response = await fetch('/api/configuration/data-management/inspect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        setInspectionResult(result.data);
      } else {
        setError(result.error || 'Inspection failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during inspection');
    } finally {
      setInspecting(false);
    }
  };

  const handleExecute = async () => {
    if (!inspectionResult) return;

    setExecuting(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Starting data insertion...');

    try {
      const response = await fetch('/api/configuration/data-management/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ 
          dataPoints: inspectionResult.allDataPoints
        })
      });

      const result = await response.json();
      if (result.success) {
        setOperationId(result.data.operationId);
      } else {
        setError(result.error || 'Execution failed');
        setExecuting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error during execution');
      setExecuting(false);
    }
  };

  const handleDownloadSql = async () => {
    if (!inspectionResult) return;

    try {
      const response = await fetch('/api/configuration/data-management/generate-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ 
          dataPoints: inspectionResult.allDataPoints,
          filename: `${inspectionResult.tagName}_import.sql`
        })
      });

      if (!response.ok) throw new Error('Failed to generate SQL');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${inspectionResult.tagName}_import.sql`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('SQL file generated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to download SQL');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
          <Database className="h-5 w-5 mr-2 text-primary-600" />
          Data Import Management
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">1. Select Data Source</label>
            <div 
              className={cn(
                "relative group flex flex-col items-center justify-center px-6 py-10 border-2 border-dashed rounded-xl transition-all duration-200",
                files.length > 0 ? "border-primary-500 bg-primary-50/30" : "border-gray-300 hover:border-primary-400 bg-gray-50/50"
              )}
            >
              <input 
                id="file-upload" 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                multiple 
                onChange={handleFileChange} 
              />
              <Upload className={cn("h-10 w-10 mb-3", files.length > 0 ? "text-primary-600" : "text-gray-400")} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Click or drag to upload'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supports CSV, XLS, TXT, and PlantScada Trend files</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 flex items-center">
                    <FileText className="h-3 w-3 mr-1" />
                    {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">2. Configure Format</label>
            <div className="space-y-3">
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="block w-full px-4 py-3 text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-shadow shadow-sm"
              >
                <option value="csv">CSV (Comma Separated)</option>
                <option value="xls">Excel (XLS/XLSX)</option>
                <option value="txt">Text (UTF-16LE / Serial Dates)</option>
                <option value="trend">Trend (HST + Data Files)</option>
              </select>

              <Button 
                onClick={handleInspect} 
                disabled={files.length === 0 || inspecting || executing}
                className="w-full py-6 text-base font-semibold"
              >
                {inspecting ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <FileText className="h-5 w-5 mr-2" />}
                {inspecting ? 'Analyzing Files...' : 'Analyze and Inspect Data'}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start text-red-800 animate-in fade-in zoom-in-95 duration-200">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start text-green-800 animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-medium">{success}</div>
          </div>
        )}

        {inspectionResult && (
          <div className="mt-8 space-y-6 border-t pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Target Tag" value={inspectionResult.tagName} icon={<Tag className="h-4 w-4" />} />
              <StatCard label="Data Points" value={inspectionResult.rowCount.toLocaleString()} icon={<BarChart3 className="h-4 w-4" />} />
              <StatCard label="Start Time" value={new Date(inspectionResult.startTime).toLocaleString()} icon={<Clock className="h-4 w-4" />} />
              <StatCard label="End Time" value={new Date(inspectionResult.endTime).toLocaleString()} icon={<Clock className="h-4 w-4" />} />
            </div>

            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 bg-gray-100/50 border-b flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Data Preview</span>
                <button 
                  onClick={() => setShowSql(!showSql)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {showSql ? 'Show Table' : 'Show SQL'}
                </button>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {showSql ? (
                  <pre className="p-4 text-[10px] font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {inspectionResult.sqlPreview}
                  </pre>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timestamp</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Value</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {inspectionResult.sampleData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-2.5 whitespace-nowrap text-xs text-gray-600">
                            {new Date(row.dateTime).toLocaleString()}
                          </td>
                          <td className="px-6 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{row.value}</td>
                          <td className="px-6 py-2.5 whitespace-nowrap text-xs text-gray-400 font-mono">{row.quality}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="bg-blue-100 p-2 rounded-lg hidden sm:block">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-blue-900">Final Confirmation</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Ready to import <strong>{inspectionResult.rowCount.toLocaleString()}</strong> records. 
                  This will perform a bulk insert into the AVEVA Historian <code>History</code> table.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  onClick={handleDownloadSql}
                  variant="secondary"
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm px-6"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download SQL
                </Button>
                <Button 
                  onClick={handleExecute} 
                  disabled={executing}
                  className="bg-primary-600 hover:bg-primary-700 text-white shadow-md px-8 py-3 h-auto"
                >
                  {executing ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                  Confirm Import
                </Button>
              </div>
            </div>
          </div>
        )}

        {executing && (
          <div className="mt-8 p-8 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Process Status</p>
                <p className="text-sm font-semibold text-gray-900">{progressMessage}</p>
              </div>
              <span className="text-2xl font-black text-primary-600 tabular-nums">{progress}%</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-primary-600 transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
    <div className="flex items-center text-gray-400 mb-1">
      {icon && <span className="mr-1.5">{icon}</span>}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-sm font-bold text-gray-900 truncate" title={value}>{value}</div>
  </div>
);

