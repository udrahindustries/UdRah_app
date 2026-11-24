// User Administration Table Component
// Displays System Accounts, Device Allocations, And Role Promotion / Demotion Actions

import React from 'react';
import { Users, Shield, User, Award } from 'lucide-react';
import { AdminUser, ApiService } from '../../Services/ApiService';

interface UsersTableProps {
  users: AdminUser[];
  onRefresh: () => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({ users, onRefresh }) => {
  const handleRoleToggle = async (userId: number, currentRole: 'user' | 'admin') => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await ApiService.UpdateUserRole(userId, nextRole);
      onRefresh();
    } catch (e) {
      console.error('Failed To Update User Authorization Role');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">User Identity & Access Management</h2>
        <p className="text-xs text-slate-500">Manage Registered Accounts And Elevated Administrative Privileges</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
            <tr>
              <th className="px-5 py-3">Account Identity</th>
              <th className="px-5 py-3">Email Address</th>
              <th className="px-5 py-3">Linked Devices</th>
              <th className="px-5 py-3">Access Level</th>
              <th className="px-5 py-3 text-right">Role Management</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                    {user.full_name?.charAt(0) || 'U'}
                  </div>
                  {user.full_name}
                </td>
                <td className="px-5 py-3.5 font-mono-numbers text-slate-500">{user.email}</td>
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-slate-800 font-mono-numbers">{user.registered_device_count}</span>{' '}
                  <span className="text-slate-400">Registered</span>
                </td>
                <td className="px-5 py-3.5">
                  {user.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      <Shield className="w-3 h-3" />
                      Administrator
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                      <User className="w-3 h-3" />
                      User
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => handleRoleToggle(user.id, user.role)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      user.role === 'admin'
                        ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                        : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    {user.role === 'admin' ? 'Demote To User' : 'Promote To Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
