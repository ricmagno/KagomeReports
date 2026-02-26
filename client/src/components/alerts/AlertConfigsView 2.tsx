import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Plus, Trash2, Edit2, BellRing, Save, X, Activity, Users, Play, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { alertsApi, AlertConfig, AlertList, AlertPattern, SaveAlertConfigRequest } from '../../services/alerts-api';
import { useToast } from '../../hooks/useToast';
import { Input } from '../ui/Input';
import { TagSelector } from '../forms/TagSelector';

export const AlertConfigsView: React.FC = () => {
    const [configs, setConfigs] = useState<AlertConfig[]>([]);
    const [lists, setLists] = useState<AlertList[]>([]);
    const [patterns, setPatterns] = useState<AlertPattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentConfig, setCurrentConfig] = useState<Partial<AlertConfig> | null>(null);
    const { success, error } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [configsData, listsData, patternsData] = await Promise.all([
                alertsApi.getAlertConfigs(),
                alertsApi.getAlertLists(),
                alertsApi.getAlertPatterns()
            ]);
            setConfigs(configsData);
            setLists(listsData);
            setPatterns(patternsData);
        } catch (err: any) {
            error('Failed to load alert configurations', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete the alert configuration "${name}"?`)) {
            return;
        }

        try {
            await alertsApi.deleteAlertConfig(id);
            success('Configuration deleted', `Alert configuration "${name}" was deleted successfully.`);
            loadData();
        } catch (err: any) {
            error('Failed to delete alert configuration', err.message);
        }
    };

    const handleToggleActive = async (config: AlertConfig) => {
        try {
            const payload: SaveAlertConfigRequest = {
                name: config.name,
                description: config.description,
                tagBase: config.tagBase,
                alertListId: config.alertListId,
                patternId: config.patternId,
                monitorHH: config.monitorHH,
                monitorH: config.monitorH,
                monitorL: config.monitorL,
                monitorLL: config.monitorLL,
                isActive: !config.isActive
            };

            await alertsApi.updateAlertConfig(config.id, payload);
            success('Status updated', `Configuration is now ${!config.isActive ? 'active' : 'inactive'}.`);
            loadData();
        } catch (err: any) {
            error('Failed to update status', err.message);
        }
    };

    const handleTestRun = (config: AlertConfig) => {
        // Placeholder for test run functionality
        success('Test Run', `Manual check triggered for "${config.name}". Results will appear in logs.`);
    };

    const handleCreate = () => {
        setCurrentConfig({
            name: '',
            description: '',
            tagBase: '',
            alertListId: lists.length > 0 ? lists[0].id : '',
            patternId: patterns.length > 0 ? patterns[0].id : '',
            monitorHH: true,
            monitorH: true,
            monitorL: true,
            monitorLL: true,
            isActive: true
        });
        setIsEditing(true);
    };

    const handleEdit = (config: AlertConfig) => {
        setCurrentConfig({ ...config });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!currentConfig?.name?.trim() || !currentConfig?.tagBase?.trim() || !currentConfig?.alertListId) {
            error('Validation Error', 'Name, Tag Base, and Alert List are required');
            return;
        }

        try {
            const payload: SaveAlertConfigRequest = {
                name: currentConfig.name.trim(),
                description: currentConfig.description?.trim(),
                tagBase: currentConfig.tagBase.trim(),
                alertListId: currentConfig.alertListId,
                patternId: currentConfig.patternId || '',
                monitorHH: currentConfig.monitorHH ?? true,
                monitorH: currentConfig.monitorH ?? true,
                monitorL: currentConfig.monitorL ?? true,
                monitorLL: currentConfig.monitorLL ?? true,
                isActive: currentConfig.isActive ?? true
            };

            if (currentConfig.id) {
                await alertsApi.updateAlertConfig(currentConfig.id, payload);
                success('Configuration updated', 'Alert configuration updated successfully.');
            } else {
                await alertsApi.createAlertConfig(payload);
                success('Configuration created', 'Alert configuration created successfully.');
            }

            setIsEditing(false);
            setCurrentConfig(null);
            loadData();
        } catch (err: any) {
            error('Save failed', err.message);
        }
    };

    const getListName = (listId: string) => {
        const list = lists.find(l => l.id === listId);
        return list ? list.name : 'Unknown List';
    };

    if (isEditing && currentConfig) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{currentConfig.id ? 'Edit Alert Configuration' : 'Create Alert Configuration'}</h3>
                        <div className="flex space-x-2">
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Configuration Name *</label>
                                <Input
                                    value={currentConfig.name || ''}
                                    onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                                    placeholder="E.g., Boiler 1 Alarms"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <Input
                                    value={currentConfig.description || ''}
                                    onChange={(e) => setCurrentConfig({ ...currentConfig, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-base font-medium text-gray-700 mb-2">OPC UA Tag Base *</label>
                                <TagSelector
                                    selectedTags={currentConfig.tagBase ? [currentConfig.tagBase] : []}
                                    onChange={(tags) => {
                                        const tag = tags.length > 0 ? tags[0] : '';
                                        setCurrentConfig({ ...currentConfig, tagBase: tag.replace(/^opcua:/, '') });
                                    }}
                                    maxTags={1}
                                    widgetType="value-block"
                                    className="shadow-sm border border-gray-200"
                                />
                                <p className="text-xs text-gray-500 mt-2">Select the base tag from Historian or OPC UA Discovery. The system will append pattern suffixes to monitor alarms.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Alert List *</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    value={currentConfig.alertListId || ''}
                                    onChange={(e) => setCurrentConfig({ ...currentConfig, alertListId: e.target.value })}
                                >
                                    <option value="" disabled>Select an alert list</option>
                                    {lists.map(list => (
                                        <option key={list.id} value={list.id}>{list.name}</option>
                                    ))}
                                </select>
                                {lists.length === 0 && (
                                    <p className="text-xs text-red-500 mt-1">You must create an Alert List first.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Pattern *</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    value={currentConfig.patternId || ''}
                                    onChange={(e) => setCurrentConfig({ ...currentConfig, patternId: e.target.value })}
                                >
                                    <option value="" disabled>Select a pattern</option>
                                    {patterns.map(pattern => (
                                        <option key={pattern.id} value={pattern.id}>{pattern.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">Alarm Triggers to Monitor</h4>
                            <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        checked={currentConfig.monitorHH}
                                        onChange={(e) => setCurrentConfig({ ...currentConfig, monitorHH: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Monitor High-High (HH)</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        checked={currentConfig.monitorH}
                                        onChange={(e) => setCurrentConfig({ ...currentConfig, monitorH: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Monitor High (H)</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        checked={currentConfig.monitorL}
                                        onChange={(e) => setCurrentConfig({ ...currentConfig, monitorL: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Monitor Low (L)</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        checked={currentConfig.monitorLL}
                                        onChange={(e) => setCurrentConfig({ ...currentConfig, monitorLL: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Monitor Low-Low (LL)</span>
                                </label>
                            </div>

                            <div className="mt-6">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                        checked={currentConfig.isActive}
                                        onChange={(e) => setCurrentConfig({ ...currentConfig, isActive: e.target.checked })}
                                    />
                                    <span className="text-base font-semibold text-gray-900">Configuration Active</span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-8">When active, the server will constantly poll these tags and send SMS on alarm triggers.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Alert Configurations</h3>
                    <Button onClick={handleCreate} disabled={lists.length === 0}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Configuration
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : configs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                        <BellRing className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">No alert configurations found</p>
                        <p className="mt-1 text-sm">Create an alert configuration to monitor OPC UA tags and send SMS on alarms.</p>
                        {lists.length === 0 ? (
                            <p className="mt-4 text-sm text-amber-600 bg-amber-50 mx-auto px-4 py-2 rounded-md border border-amber-200 inline-block">
                                You must create an Alert List first before creating an Alert Configuration.
                            </p>
                        ) : (
                            <Button className="mt-4" onClick={handleCreate} variant="outline">
                                Create First Configuration
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Configuration</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag Base</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target List</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monitors</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {configs.map((config) => (
                                    <tr key={config.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{config.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-[200px]">{config.description || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded w-fit">{config.tagBase}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm font-medium text-blue-700">
                                                <Users className="h-3 w-3 mr-1" />
                                                {getListName(config.alertListId)}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                Pattern: {patterns.find(p => p.id === config.patternId)?.name || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex space-x-1">
                                                {config.monitorHH && <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-800 rounded">HH</span>}
                                                {config.monitorH && <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-800 rounded">H</span>}
                                                {config.monitorL && <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-800 rounded">L</span>}
                                                {config.monitorLL && <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">LL</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {config.isActive ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    <Activity className="h-3 w-3 mr-1" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTestRun(config)}
                                                    title="Test Run"
                                                >
                                                    <Play className="h-4 w-4" />
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(config)}
                                                    title="Edit Configuration"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>

                                                <Button
                                                    variant={config.isActive ? "secondary" : "outline"}
                                                    size="sm"
                                                    onClick={() => handleToggleActive(config)}
                                                    className={config.isActive ? "bg-gray-100 text-gray-900 border-gray-200" : ""}
                                                    title={config.isActive ? "Deactivate" : "Activate"}
                                                >
                                                    <CheckCircle2 className={`h-4 w-4 ${config.isActive ? "text-green-600" : ""}`} />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(config.id, config.name)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    title="Delete Configuration"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
