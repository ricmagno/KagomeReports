import React, { useState } from 'react';
import { alertsApi, AlertList, AlertConfig } from '../../services/alerts-api';
import { useToast } from '../../hooks/useToast';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Plus, Users, BellRing, Settings } from 'lucide-react';
import { AlertListsView } from './AlertListsView';
import { AlertConfigsView } from './AlertConfigsView';
import { AlertPatternsView } from './AlertPatternsView';
import { useAuth } from '../../hooks/useAuth';

export const AlertsManagement: React.FC = () => {
    const [subTab, setSubTab] = useState<'lists' | 'configs' | 'patterns'>('lists');
    const { isAdmin } = useAuth();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Alerts Management</h2>
                    <p className="text-gray-600">
                        Manage SMS notification lists and OPC UA alert configurations.
                    </p>
                </div>
            </div>

            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setSubTab('lists')}
                    className={`flex items-center px-4 py-2 border-b-2 font-medium text-sm transition-colors ${subTab === 'lists'
                        ? "border-primary-600 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                >
                    <Users className="h-4 w-4 mr-2" />
                    Alert Lists
                </button>
                <button
                    onClick={() => setSubTab('configs')}
                    className={`flex items-center px-4 py-2 border-b-2 font-medium text-sm transition-colors ${subTab === 'configs'
                        ? "border-primary-600 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                >
                    <BellRing className="h-4 w-4 mr-2" />
                    Alert Configurations
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setSubTab('patterns')}
                        className={`flex items-center px-4 py-2 border-b-2 font-medium text-sm transition-colors ${subTab === 'patterns'
                            ? "border-primary-600 text-primary-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Alert Patterns
                    </button>
                )}
            </div>

            <div className="mt-4">
                {subTab === 'lists' && <AlertListsView />}
                {subTab === 'configs' && <AlertConfigsView />}
                {subTab === 'patterns' && isAdmin && <AlertPatternsView />}
            </div>
        </div>
    );
};
