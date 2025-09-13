import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Shield, UserCheck, Users } from 'lucide-react';
import api from '../../services/api';
import { authService } from '../../services/auth';
import MFASetup from '../auth/MFASetup';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showMFASetup, setShowMFASetup] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        loadAdminData();
    }, []);

    const loadAdminData = async () => {
        try {
            setLoading(true);

            const [statsRes, usersRes, jobsRes] = await Promise.all([
                api.get('/jobs/admin/stats'),
                api.get('/auth/users'),
                api.get('/jobs/admin/all?limit=10')
            ]);

            setStats(statsRes.data.stats);
            setUsers(usersRes.data.result);
            setJobs(jobsRes.data.jobs);
        } catch (error) {
            setError('Failed to load admin data');
            console.error('Admin data loading error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            await api.delete(`/auth/users/${userId}`);
            setUsers(users.filter(user => user.id !== userId));
        } catch (error) {
            console.error('Delete user error:', error);
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (!window.confirm('Are you sure you want to delete this job?')) return;

        try {
            await api.delete(`/jobs/admin/${jobId}`);
            setJobs(jobs.filter(job => job.id !== jobId));
        } catch (error) {
            console.error('Delete job error:', error);
        }
    };

    const handlePromoteToAdmin = async (userEmail) => {
        if (!window.confirm('Promote this user to Admin group?')) return;
        
        try {
            await authService.promoteToAdmin(userEmail);
            await loadAdminData();
        } catch (error) {
            console.error('Promote to admin error:', error);
        }
    };

    const handleViewPermissions = async (userEmail) => {
        try {
            const permissions = await authService.getUserPermissions(userEmail);
            alert(`User Permissions:\nGroups: ${permissions.groups.join(', ')}\nRole: ${permissions.role}\nPermissions: ${permissions.permissions.join(', ')}`);
        } catch (error) {
            console.error('Get permissions error:', error);
        }
    };

    const handleMFAEnabled = () => {
        setShowMFASetup(false);
        alert('MFA enabled successfully!');
    };

    const handleMFACancel = () => {
        setShowMFASetup(false);
    };

    if (loading) return <div className="p-6">Loading admin dashboard...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    if (showMFASetup) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                        <Button
                            onClick={() => setShowMFASetup(false)}
                            variant="outline"
                            className="mb-4"
                        >
                            ← Back to Dashboard
                        </Button>
                        <h1 className="text-2xl font-bold text-gray-900">Multi-Factor Authentication Setup</h1>
                    </div>
                    <MFASetup onMFAEnabled={handleMFAEnabled} onCancel={handleMFACancel} />
                </div>
            </div>
        );
    }

    return (
      <div className='p-6 space-y-6'>
        <div className="flex justify-between items-center">
          <h1 className='text-2xl font-bold text-gray-900'>Admin Dashboard</h1>
          <Button
            onClick={() => setShowMFASetup(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            Set Up MFA
          </Button>
        </div>

        {stats && (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <Card className='p-4'>
              <h3 className='text-lg font-semibold mb-2'>Total Users</h3>
              <p className='text-2xl font-bold text-blue-600'>
                {stats.totalUsers}
              </p>
            </Card>
            <Card className='p-4'>
              <h3 className='text-lg font-semibold mb-2'>Recent Jobs (24h)</h3>
              <p className='text-2xl font-bold text-green-600'>
                {stats.recentJobs}
              </p>
            </Card>
            <Card className='p-4'>
              <h3 className='text-lg font-semibold mb-2'>Job Stats</h3>
              <div className='space-y-1 text-sm'>
                {Object.entries(stats.jobStats).map(([status, data]) => (
                  <div key={status} className='flex justify-between'>
                    <span>{status}:</span>
                    <span className='font-medium'>{data.count || 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <Card className='p-4'>
            <h3 className='text-lg font-semibold mb-4'>Users</h3>
            <div className='space-y-2'>
              {users.map((user) => (
                <div
                  key={user.id}
                  className='flex items-center justify-between p-2 bg-gray-50 rounded'
                >
                  <div>
                    <div className='font-medium'>{user.username || user.email}</div>
                    <div className='text-sm text-gray-600'>{user.email}</div>
                    <span
                      className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                        user.role === 'admin'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className='flex flex-col space-y-1'>
                    <div className='flex space-x-1'>
                      {user.role !== 'admin' && (
                        <Button
                          onClick={() => handlePromoteToAdmin(user.email)}
                          size="sm"
                          className='text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1'
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Make Admin
                        </Button>
                      )}
                      <Button
                        onClick={() => handleViewPermissions(user.email)}
                        size="sm"
                        variant="outline"
                        className='text-xs px-2 py-1'
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Permissions
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleDeleteUser(user.id)}
                      size="sm"
                      className='text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1'
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className='p-4'>
            <h3 className='text-lg font-semibold mb-4'>Recent Jobs</h3>
            <div className='space-y-2'>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className='flex items-center justify-between p-2 bg-gray-50 rounded'
                >
                  <div>
                    <div className='font-medium'>Job #{job.id}</div>
                    <div className='text-sm text-gray-600'>
                      {job.user_email}
                    </div>
                    <div className='text-xs text-gray-500'>
                      Status: <span className='font-medium'>{job.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className='px-3 py-2 cursor-pointer text-xs bg-red-600 text-white rounded-md hover:bg-red-700 border border-red-600'
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
};

export default AdminDashboard;