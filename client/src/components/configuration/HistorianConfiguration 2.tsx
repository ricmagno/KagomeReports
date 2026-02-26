import React, { useState } from 'react';
import { Activity, Settings, Database } from 'lucide-react';
import { cn } from '../../utils/cn';
import { StatusDashboard } from '../status/StatusDashboard';
import { DatabaseConfigManager } from '../forms/DatabaseConfigManager';

export const HistorianConfiguration: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<'status' | 'config'>('status');

    return (
        <div className="space-y-6">
            <div className="flex space-x-4 border-b border-gray-100">
                <button
                    onClick={() => setActiveSubTab('status')}
                    className={cn(
                        "flex items-center space-x-2 pb-2 px-1 text-sm font-medium transition-colors border-b-2",
                        activeSubTab === 'status'
                            ? "border-primary-600 text-primary-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Activity className="h-4 w-4" />
                    <span>Live Status</span>
                </button>
                <button
                    onClick={() => setActiveSubTab('config')}
                    className={cn(
                        "flex items-center space-x-2 pb-2 px-1 text-sm font-medium transition-colors border-b-2",
                        activeSubTab === 'config'
                            ? "border-primary-600 text-primary-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Settings className="h-4 w-4" />
                    <span>Connection Settings</span>
                </button>
            </div>

            <div className="mt-4 transition-all duration-300">
                {activeSubTab === 'status' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <StatusDashboard autoRefresh={true} refreshInterval={30} hideHeader={true} />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <DatabaseConfigManager />
                    </div>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start space-x-3">
                <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700">
                    <p className="font-semibold">Pro Tip:</p>
                    <p>
                        You can configure multiple Historian servers and switch between them.
                        The application will automatically use the active connection for all reports and dashboards.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HistorianConfiguration;
