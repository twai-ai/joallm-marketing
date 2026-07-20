import React, { useState } from 'react';
import { User, Mail, Calendar, Crown, Settings, LogOut, Edit3, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { showSuccess, showError } from '../../utils/toast';

interface UserProfileProps {
  className?: string;
}

export function UserProfile({ className = '' }: UserProfileProps) {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading user profile...</p>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);
      await updateProfile({ name: formData.name });
      setIsEditing(false);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      showError(error.message);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getSubscriptionColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'pro': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Profile Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-white" />
          )}
        </div>
        
        {isEditing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full name"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleSaveProfile}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({ name: user.name, email: user.email });
                }}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{user.name}</h3>
            <p className="text-gray-600 mb-4">{user.email}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Mail className="w-5 h-5 text-gray-500 mr-3" />
            <span className="text-sm font-medium text-gray-700">Email</span>
          </div>
          <span className="text-sm text-gray-900">{user.email}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Crown className="w-5 h-5 text-gray-500 mr-3" />
            <span className="text-sm font-medium text-gray-700">Role</span>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
            {user.role}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Settings className="w-5 h-5 text-gray-500 mr-3" />
            <span className="text-sm font-medium text-gray-700">Plan</span>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSubscriptionColor(user.subscriptionTier)}`}>
            {user.subscriptionTier}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 text-gray-500 mr-3" />
            <span className="text-sm font-medium text-gray-700">Member since</span>
          </div>
          <span className="text-sm text-gray-900">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Usage Stats */}
      {user.usageStats && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Usage This Month</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-900">{user.usageStats.totalTokens.toLocaleString()}</div>
              <div className="text-xs text-blue-700">Tokens</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-900">{user.usageStats.totalRequests.toLocaleString()}</div>
              <div className="text-xs text-blue-700">Requests</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-900">{user.usageStats.totalFiles}</div>
              <div className="text-xs text-blue-700">Files</div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password */}
      {isChangingPassword ? (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Change Password</h4>
          <input
            type="password"
            placeholder="Current password"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="New password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleChangePassword}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Change Password
            </button>
            <button
              onClick={() => {
                setIsChangingPassword(false);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsChangingPassword(true)}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Settings className="w-4 h-4 mr-2" />
          Change Password
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </button>
    </div>
  );
}
