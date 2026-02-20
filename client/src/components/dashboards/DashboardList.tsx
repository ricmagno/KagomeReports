import React, { useState, useEffect } from 'react';
import {
    Plus,
    Activity,
    Trash2,
    Edit2,
    Eye,
    Download,
    Upload,
    Clock,
    User,
    MoreVertical
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DashboardListItem } from '../../types/dashboard';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface DashboardListProps {
    onView: (id: string) => void;
    onEdit: (id: string) => void;
    onCreate: () => void;
}

export const DashboardList: React.FC<DashboardListProps> = ({
    onView,
    onEdit,
    onCreate
}) => {
    const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { success, error } = useToast();

    const fetchDashboards = async () => {
        try {
            setLoading(true);
            const response = await apiService.getDashboards();
            if (response.success) {
                setDashboards(response.data);
            } else {
                error('Failed to load dashboards');
            }
        } catch (err) {
            console.error('Error loading dashboards:', err);
            error('Failed to load dashboards');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboards();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete dashboard "${name}"?`)) return;

        try {
            const response = await apiService.deleteDashboard(id);
            if (response.success) {
                success('Dashboard deleted');
                fetchDashboards();
            } else {
                error('Failed to delete dashboard');
            }
        } catch (err) {
            console.error('Error deleting dashboard:', err);
            error('Failed to delete dashboard');
        }
    };

    const filteredDashboards = dashboards.filter(db =>
        db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        db.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Input
                        placeholder="Search dashboards..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {/* Handle import */ }}>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                    </Button>
                    <Button size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Dashboard
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : filteredDashboards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDashboards.map((dashboard) => (
                        <Card key={dashboard.id} className="hover:shadow-md transition-shadow group">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                                            {dashboard.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 line-clamp-2 mt-1 min-h-[40px]">
                                            {dashboard.description || 'No description provided'}
                                        </p>
                                    </div>
                                    <div className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ml-2">
                                        v{dashboard.version}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mb-6">
                                    <div className="flex items-center">
                                        <User className="h-3 w-3 mr-1" />
                                        {dashboard.createdBy}
                                    </div>
                                    <div className="flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {new Date(dashboard.updatedAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center">
                                        <Activity className="h-3 w-3 mr-1" />
                                        {dashboard.config.widgets.length} widgets
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onView(dashboard.id)}
                                        className="w-full"
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onEdit(dashboard.id)}
                                            className="flex-1"
                                            title="Edit Dashboard"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {/* Handle export */ }}
                                            className="flex-1"
                                            title="Export Dashboard"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(dashboard.id, dashboard.name)}
                                            className="flex-1 text-red-600 hover:bg-red-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">
                        {searchTerm ? 'No dashboards found matching your search' : 'No dashboards created yet'}
                    </p>
                    <p className="mt-1">
                        {searchTerm ? 'Try a different search term' : 'Create your first real-time dashboard to get started'}
                    </p>
                    {!searchTerm && (
                        <Button className="mt-6" onClick={onCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Dashboard
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};
