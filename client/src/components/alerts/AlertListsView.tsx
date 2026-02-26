import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Plus, Trash2, Edit2, Users, Save, X } from 'lucide-react';
import { alertsApi, AlertList, SaveAlertListRequest } from '../../services/alerts-api';
import { getUsers } from '../../services/users-api';
import { User, UserFilters } from '../../types/user';
import { useToast } from '../../hooks/useToast';
import { Input } from '../ui/Input';

export const AlertListsView: React.FC = () => {
    const [lists, setLists] = useState<AlertList[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentList, setCurrentList] = useState<Partial<AlertList> | null>(null);
    const { success, error } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [listsData, usersData] = await Promise.all([
                alertsApi.getAlertLists(),
                getUsers({ isActive: true }, 1000, 0).catch(e => {
                    console.warn('Failed to load users for alert lists:', e);
                    return { data: [] };
                })
            ]);
            setLists(listsData);
            setUsers(usersData.data || []);
        } catch (err: any) {
            error('Failed to load alert lists data', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete the alert list "${name}"?`)) {
            return;
        }

        try {
            await alertsApi.deleteAlertList(id);
            success('List deleted', `Alert list "${name}" was deleted successfully.`);
            loadData();
        } catch (err: any) {
            error('Failed to delete alert list', err.message);
        }
    };

    const handleCreate = () => {
        setCurrentList({ name: '', description: '', members: [] });
        setIsEditing(true);
    };

    const handleEdit = (list: AlertList) => {
        setCurrentList({ ...list, members: [...list.members] });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!currentList?.name?.trim()) {
            error('Validation Error', 'List name is required');
            return;
        }

        try {
            const payload: SaveAlertListRequest = {
                name: currentList.name.trim(),
                description: currentList.description?.trim(),
                members: currentList.members || []
            };

            if (currentList.id) {
                await alertsApi.updateAlertList(currentList.id, payload);
                success('List updated', 'Alert list updated successfully.');
            } else {
                await alertsApi.createAlertList(payload);
                success('List created', 'Alert list created successfully.');
            }

            setIsEditing(false);
            setCurrentList(null);
            loadData();
        } catch (err: any) {
            error('Save failed', err.message);
        }
    };

    const handleAddMember = () => {
        if (currentList) {
            setCurrentList({
                ...currentList,
                members: [...(currentList.members || []), { name: '', phone: '', email: '' }]
            });
        }
    };

    const handleAddAppUser = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const userId = e.target.value;
        if (!userId) return;

        const user = users.find(u => u.id === userId);
        if (user && currentList) {
            const name = `${user.firstName} ${user.lastName}`.trim();
            const phone = user.mobile || '';
            const email = user.email || '';

            // Check if user is already added (naively by email or phone)
            const exists = currentList.members?.some(m =>
                (m.email && m.email === email) ||
                (m.phone && m.phone === phone && phone.length > 0)
            );

            if (exists) {
                error('User already added', `${name} is already in the list.`);
                // Reset select dropdown
                e.target.value = '';
                return;
            }

            setCurrentList({
                ...currentList,
                members: [...(currentList.members || []), { name, phone, email }]
            });
            success('User added', `${name} added to the list.`);

            // Reset select dropdown
            e.target.value = '';
        }
    };

    const handleRemoveMember = (index: number) => {
        if (currentList && currentList.members) {
            const updatedMembers = [...currentList.members];
            updatedMembers.splice(index, 1);
            setCurrentList({ ...currentList, members: updatedMembers });
        }
    };

    const handleMemberChange = (index: number, field: 'name' | 'phone' | 'email', value: string) => {
        if (currentList && currentList.members) {
            const updatedMembers = [...currentList.members];
            updatedMembers[index] = { ...updatedMembers[index], [field]: value };
            setCurrentList({ ...currentList, members: updatedMembers });
        }
    };

    if (isEditing && currentList) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{currentList.id ? 'Edit Alert List' : 'Create Alert List'}</h3>
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
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">List Name *</label>
                            <Input
                                value={currentList.name || ''}
                                onChange={(e) => setCurrentList({ ...currentList, name: e.target.value })}
                                placeholder="E.g., Maintenance Team"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <Input
                                value={currentList.description || ''}
                                onChange={(e) => setCurrentList({ ...currentList, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-medium text-gray-900">Members</h4>
                            <div className="flex space-x-3">
                                <select
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    onChange={handleAddAppUser}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select App User...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.firstName} {user.lastName} {user.mobile ? `(${user.mobile})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <Button variant="outline" size="sm" onClick={handleAddMember}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Manual Member
                                </Button>
                            </div>
                        </div>

                        {(!currentList.members || currentList.members.length === 0) ? (
                            <div className="text-center py-6 bg-gray-50 rounded-md border border-gray-200">
                                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No members added yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentList.members.map((member, index) => (
                                    <div key={index} className="flex items-start space-x-3 bg-gray-50 p-3 rounded-md border border-gray-200">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                                                <Input
                                                    value={member.name}
                                                    onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                                                    placeholder="John Doe"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                                                <Input
                                                    value={member.phone || ''}
                                                    onChange={(e) => handleMemberChange(index, 'phone', e.target.value)}
                                                    placeholder="+61400000000"
                                                    className="h-8 text-sm"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-0.5">Include country code (e.g., +61)</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                                <Input
                                                    value={member.email || ''}
                                                    onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                                                    placeholder="john@example.com"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveMember(index)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Notification Lists</h3>
                    <Button onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New List
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : lists.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                        <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">No alert lists found</p>
                        <p className="mt-1 text-sm">Create a list to start grouping people for SMS notifications.</p>
                        <Button className="mt-4" onClick={handleCreate} variant="outline">
                            Create First List
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">List Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {lists.map((list) => (
                                    <tr key={list.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{list.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">Created: {new Date(list.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 line-clamp-2 max-w-xs">{list.description || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm font-medium text-gray-900 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full w-fit">
                                                {list.members?.length || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(list)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(list.id, list.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
