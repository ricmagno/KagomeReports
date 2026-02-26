import React, { useState, useEffect } from 'react';
import {
    Server,
    Plus,
    Trash2,
    Play,
    Activity,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Shield,
    Key,
    Globe
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { apiService } from '../../services/api';
import { OpcuaConfig, OpcuaConfiguration as OpcuaConfigType } from '../../types/opcuaConfig';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

export const OpcuaConfiguration: React.FC = () => {
    const [configs, setConfigs] = useState<OpcuaConfigType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { success, error: toastError, info } = useToast();

    const [newConfig, setNewConfig] = useState<OpcuaConfig>({
        name: '',
        endpointUrl: 'opc.tcp://localhost:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        authenticationMode: 'Anonymous'
    });

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            setIsLoading(true);
            const response = await apiService.getOpcuaConfigs();
            if (response.success && response.data) {
                setConfigs(response.data);
            }
        } catch (err) {
            console.error('Failed to load OPC UA configs:', err);
            toastError('Failed to load configurations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestConnection = async (config: OpcuaConfig, id?: string) => {
        try {
            setIsTesting(id || 'new');
            const response = await apiService.testOpcuaConnection(config);
            if (response.success) {
                success('Connection Successful', response.message);
            } else {
                toastError('Connection Failed', response.message);
            }
        } catch (err: any) {
            toastError('Connection Failed', err.message);
        } finally {
            setIsTesting(null);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const response = await apiService.saveOpcuaConfig(newConfig);
            if (response.success) {
                success('Configuration Saved');
                setNewConfig({
                    name: '',
                    endpointUrl: 'opc.tcp://localhost:4840',
                    securityMode: 'None',
                    securityPolicy: 'None',
                    authenticationMode: 'Anonymous'
                });
                // Add a small delay to ensure backend state has settled
                setTimeout(() => loadConfigs(), 300);
            }
        } catch (err: any) {
            toastError('Failed to save configuration', err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivateConfig = async (id: string) => {
        try {
            const response = await apiService.activateOpcuaConfig(id);
            if (response.success) {
                success('Configuration Activated');
                // Add a small delay to ensure backend state has settled
                setTimeout(() => loadConfigs(), 300);
            }
        } catch (err: any) {
            toastError('Activation Failed', err.message);
        }
    };

    const handleDeleteConfig = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
        try {
            const response = await apiService.deleteOpcuaConfig(id);
            if (response.success) {
                success('Configuration Deleted');
                // Add a small delay to ensure backend state has settled
                setTimeout(() => loadConfigs(), 300);
            }
        } catch (err: any) {
            toastError('Delete Failed', err.message);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center space-x-2">
                        <Plus className="h-5 w-5 text-primary-600" />
                        <h2 className="text-xl font-semibold">Add New OPC UA Server</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveConfig} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Configuration Name</label>
                                <Input
                                    value={newConfig.name}
                                    onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
                                    placeholder="e.g. Production PLC"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Endpoint URL</label>
                                <Input
                                    value={newConfig.endpointUrl}
                                    onChange={e => setNewConfig({ ...newConfig, endpointUrl: e.target.value })}
                                    placeholder="opc.tcp://localhost:4840"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Security Mode</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    value={newConfig.securityMode}
                                    onChange={e => setNewConfig({ ...newConfig, securityMode: e.target.value as any })}
                                >
                                    <option value="None">None</option>
                                    <option value="Sign">Sign</option>
                                    <option value="SignAndEncrypt">Sign and Encrypt</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Security Policy</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    value={newConfig.securityPolicy}
                                    onChange={e => setNewConfig({ ...newConfig, securityPolicy: e.target.value as any })}
                                >
                                    <option value="None">None</option>
                                    <option value="Basic128Rsa15">Basic128Rsa15</option>
                                    <option value="Basic256">Basic256</option>
                                    <option value="Basic256Sha256">Basic256Sha256</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Authentication</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    value={newConfig.authenticationMode}
                                    onChange={e => setNewConfig({ ...newConfig, authenticationMode: e.target.value as any })}
                                >
                                    <option value="Anonymous">Anonymous</option>
                                    <option value="Username">Username / Password</option>
                                </select>
                            </div>
                        </div>

                        {newConfig.authenticationMode === 'Username' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Username</label>
                                    <Input
                                        value={newConfig.username}
                                        onChange={e => setNewConfig({ ...newConfig, username: e.target.value })}
                                        placeholder="Username"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Password</label>
                                    <Input
                                        type="password"
                                        value={newConfig.password}
                                        onChange={e => setNewConfig({ ...newConfig, password: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end space-x-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleTestConnection(newConfig)}
                                loading={isTesting === 'new'}
                            >
                                Test Connection
                            </Button>
                            <Button type="submit" loading={isSaving}>
                                Save Configuration
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                    <Server className="h-5 w-5 mr-2 text-gray-500" />
                    Configured OPC UA Servers
                </h3>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                ) : configs.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Globe className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No OPC UA servers configured yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {configs.map(config => (
                            <Card key={config.id} className={cn(
                                "border-l-4 transition-shadow hover:shadow-md",
                                config.isActive ? "border-l-green-500" : "border-l-gray-300"
                            )}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <h4 className="font-bold text-gray-900">{config.name}</h4>
                                                {config.isActive && (
                                                    <span className="flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                                                        <Activity className="h-2.5 w-2.5 mr-1" /> ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 font-mono">{config.endpointUrl}</p>
                                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                                                <span className="flex items-center">
                                                    <Shield className="h-3 w-3 mr-1" />
                                                    {config.securityMode} / {config.securityPolicy}
                                                </span>
                                                <span className="flex items-center">
                                                    <Key className="h-3 w-3 mr-1" />
                                                    {config.authenticationMode}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleTestConnection(config, config.id)}
                                                loading={isTesting === config.id}
                                                title="Test Connection"
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                            {!config.isActive && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleActivateConfig(config.id)}
                                                    title="Activate Server"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteConfig(config.id, config.name)}
                                                title="Delete Configuration"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {config.status === 'failed' && config.lastError && (
                                        <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700 flex items-start">
                                            <AlertTriangle className="h-3.5 w-3.5 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>{config.lastError}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
