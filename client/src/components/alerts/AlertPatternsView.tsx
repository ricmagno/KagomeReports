import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ShieldAlert, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { alertsApi, AlertPattern, SaveAlertPatternRequest } from '../../services/alerts-api';
import { useToast } from '../../hooks/useToast';

export const AlertPatternsView: React.FC = () => {
    const [patterns, setPatterns] = useState<AlertPattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingPattern, setEditingPattern] = useState<AlertPattern | null>(null);
    const { success, error: toastError } = useToast();

    // Form state
    const [formData, setFormData] = useState<SaveAlertPatternRequest>({
        name: '',
        description: '',
        pvSuffix: 'PV',
        hhLimitSuffix: 'HighHigh',
        hLimitSuffix: 'High',
        lLimitSuffix: 'Low',
        llLimitSuffix: 'LowLow',
        hhEventSuffix: 'HH',
        hEventSuffix: 'H',
        lEventSuffix: 'L',
        llEventSuffix: 'LL'
    });

    useEffect(() => {
        loadPatterns();
    }, []);

    const loadPatterns = async () => {
        try {
            setLoading(true);
            const data = await alertsApi.getAlertPatterns();
            setPatterns(data || []);
        } catch (error: any) {
            console.error('Failed to load alert patterns:', error);
            toastError('Error', 'Failed to load alert patterns');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (pattern: AlertPattern) => {
        setEditingPattern(pattern);
        setFormData({
            name: pattern.name,
            description: pattern.description || '',
            pvSuffix: pattern.pvSuffix,
            hhLimitSuffix: pattern.hhLimitSuffix,
            hLimitSuffix: pattern.hLimitSuffix,
            lLimitSuffix: pattern.lLimitSuffix,
            llLimitSuffix: pattern.llLimitSuffix,
            hhEventSuffix: pattern.hhEventSuffix,
            hEventSuffix: pattern.hEventSuffix,
            lEventSuffix: pattern.lEventSuffix,
            llEventSuffix: pattern.llEventSuffix
        });
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this pattern?')) return;

        try {
            await alertsApi.deleteAlertPattern(id);
            success('Success', 'Pattern deleted successfully');
            loadPatterns();
        } catch (error: any) {
            console.error('Failed to delete pattern:', error);
            toastError('Error', error.response?.data?.error || 'Failed to delete pattern because it is in use.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPattern) {
                await alertsApi.updateAlertPattern(editingPattern.id, formData);
                success('Success', 'Pattern updated successfully');
            } else {
                await alertsApi.createAlertPattern(formData);
                success('Success', 'Pattern created successfully');
            }
            setIsEditing(false);
            setEditingPattern(null);
            setFormData({
                name: '', description: '',
                pvSuffix: 'PV',
                hhLimitSuffix: 'HighHigh', hLimitSuffix: 'High', lLimitSuffix: 'Low', llLimitSuffix: 'LowLow',
                hhEventSuffix: 'HH', hEventSuffix: 'H', lEventSuffix: 'L', llEventSuffix: 'LL'
            });
            loadPatterns();
        } catch (error) {
            console.error('Failed to save pattern:', error);
            toastError('Error', 'Failed to save pattern');
        }
    };

    if (loading) return <div>Loading alert patterns...</div>;

    if (isEditing) {
        return (
            <Card>
                <CardHeader>
                    <h3 className="text-lg font-medium">{editingPattern ? 'Edit Pattern' : 'Create Pattern'}</h3>
                    <p className="text-sm text-gray-500">Configure OPC UA tag suffixes for this pattern</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pattern Name</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Analog Alarms"
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    value={formData.description}
                                    onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            {/* Process Variables */}
                            <div className="space-y-2 col-span-2 border-t pt-4">
                                <h3 className="text-lg font-medium flex items-center gap-2"><Cpu className="h-5 w-5" /> Process Variables</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">PV Suffix</label>
                                <Input
                                    required
                                    value={formData.pvSuffix}
                                    onChange={(e: any) => setFormData({ ...formData, pvSuffix: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2"></div>

                            {/* Limits */}
                            <div className="space-y-2 col-span-2 border-t pt-4">
                                <h3 className="text-lg font-medium flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Limit Values</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">HighHigh Limit Suffix</label>
                                <Input value={formData.hhLimitSuffix} onChange={(e: any) => setFormData({ ...formData, hhLimitSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">High Limit Suffix</label>
                                <Input value={formData.hLimitSuffix} onChange={(e: any) => setFormData({ ...formData, hLimitSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Low Limit Suffix</label>
                                <Input value={formData.lLimitSuffix} onChange={(e: any) => setFormData({ ...formData, lLimitSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">LowLow Limit Suffix</label>
                                <Input value={formData.llLimitSuffix} onChange={(e: any) => setFormData({ ...formData, llLimitSuffix: e.target.value })} />
                            </div>

                            {/* Alarms (Events) */}
                            <div className="space-y-2 col-span-2 border-t pt-4">
                                <h3 className="text-lg font-medium flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" /> Alarm Event Suffixes (Booleans)</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">HH Event Suffix</label>
                                <Input required value={formData.hhEventSuffix} onChange={(e: any) => setFormData({ ...formData, hhEventSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">H Event Suffix</label>
                                <Input required value={formData.hEventSuffix} onChange={(e: any) => setFormData({ ...formData, hEventSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">L Event Suffix</label>
                                <Input required value={formData.lEventSuffix} onChange={(e: any) => setFormData({ ...formData, lEventSuffix: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">LL Event Suffix</label>
                                <Input required value={formData.llEventSuffix} onChange={(e: any) => setFormData({ ...formData, llEventSuffix: e.target.value })} />
                            </div>

                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => {
                                setIsEditing(false);
                                setEditingPattern(null);
                            }}>Cancel</Button>
                            <Button type="submit">Save Pattern</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50/50 p-4 border border-blue-100 rounded-lg">
                <div>
                    <h3 className="text-lg font-medium text-blue-900">Admin Configuration</h3>
                    <p className="text-blue-700 text-sm">Define tag suffix patterns applied to incoming OPC UA alarms.</p>
                </div>
                <Button onClick={() => setIsEditing(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create Pattern
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {patterns.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-500 py-8">
                        No patterns found. Create one to get started.
                    </div>
                ) : (
                    patterns.map((pattern) => (
                        <Card key={pattern.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-lg font-medium">{pattern.name}</h4>
                                        <p className="text-sm text-gray-500">{pattern.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(pattern)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500"
                                            onClick={() => handleDelete(pattern.id)}
                                            disabled={pattern.id === 'system-analog-alarms'}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-2 text-gray-600">
                                    <div className="grid grid-cols-2 pb-2 gap-2 text-xs font-mono bg-gray-50 p-2 rounded">
                                        <div>PV: <span className="text-blue-600">.{pattern.pvSuffix}</span></div>
                                        <div>Events: </div>
                                        <div>HH: <span className="text-red-600">.{pattern.hhEventSuffix}</span></div>
                                        <div>H:  <span className="text-orange-500">.{pattern.hEventSuffix}</span></div>
                                        <div>L:  <span className="text-orange-500">.{pattern.lEventSuffix}</span></div>
                                        <div>LL: <span className="text-red-600">.{pattern.llEventSuffix}</span></div>
                                    </div>
                                    <div className="text-xs text-gray-400">ID: {pattern.id}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
