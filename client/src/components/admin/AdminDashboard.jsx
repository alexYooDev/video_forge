import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { UserCheck, Users, Activity, Database, BarChart3, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { authService } from '../../services/auth';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [systemStatus, setSystemStatus] = useState(null);
    const [storageInfo, setStorageInfo] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadAdminData();
    }, []);

    const loadAdminData = async () => {
        try {
            setLoading(true);

            const [statsRes, usersRes, jobsRes] = await Promise.all([
                api.get('/admin/jobs/stats'),
                api.get('/admin/users'),
                api.get('/admin/jobs/all?limit=10')
            ]);

            setStats(statsRes.data.stats);
            setUsers(usersRes.data.result);
            setJobs(jobsRes.data.jobs);

            // Load additional admin data
            await loadSystemStatus();
            await loadStorageInfo();
            await loadRecentActivity();
        } catch (error) {
            setError('Failed to load admin data');
            console.error('Admin data loading error:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSystemStatus = async () => {
        try {
            const response = await api.get('/jobs/admin/processing-status');
            console.log('System status response:', response.data);
            setSystemStatus(response.data);
        } catch (error) {
            console.error('Failed to load system status:', error);
        }
    };

    const loadStorageInfo = async () => {
        try {
            const response = await api.get('/admin/storage/stats');
            const stats = response.data.result;

            setStorageInfo({
                totalStorage: `${stats.bucket.totalSize} GB`,
                totalStorageMB: `${stats.bucket.totalSizeMB} MB`,
                totalFiles: stats.bucket.totalFiles,
                mediaAssets: stats.assets.total,
                recentAssets: stats.assets.recent,
                bucketName: stats.bucket.bucketName,
                lastUpdated: stats.lastUpdated
            });
        } catch (error) {
            console.error('Failed to load storage info:', error);
            // Fallback to mock data if API fails
            setStorageInfo({
                totalStorage: 'N/A',
                totalFiles: 0,
                mediaAssets: 0,
                error: 'Failed to load storage statistics'
            });
        }
    };

    const loadRecentActivity = async () => {
        try {
            const response = await api.get('/jobs/admin/recent-activity');
            setRecentActivity(response.data.activities);
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            setRecentActivity([]);
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
            console.log('User permissions:', permissions);
            alert(`User Permissions:\nRole: ${permissions.role}\nPermissions: ${permissions.permissions.join(', ')}`);
        } catch (error) {
            console.error('Get permissions error:', error);
        }
    };

    const handleRestartFailedJobs = async () => {
        if (!window.confirm('Restart all failed jobs? This will reset their status to PENDING.')) return;

        try {
            await api.post('/jobs/admin/restart-failed');
            await loadAdminData();
            alert('Failed jobs have been restarted');
        } catch (error) {
            console.error('Restart failed jobs error:', error);
            alert('Failed to restart jobs');
        }
    };

    const handleClearOldJobs = async () => {
        if (!window.confirm('Delete all completed jobs older than 30 days? This cannot be undone.')) return;

        try {
            await api.delete('/jobs/admin/cleanup-old');
            await loadAdminData();
            alert('Old jobs have been cleaned up');
        } catch (error) {
            console.error('Cleanup jobs error:', error);
            alert('Failed to cleanup jobs');
        }
    };

    const handleRefreshSystemStatus = async () => {
        await loadSystemStatus();
        alert('System status refreshed');
    };

    const handleCleanupTempFiles = async () => {
        if (!window.confirm('Clean up temporary files older than 24 hours? This action cannot be undone.')) return;

        try {
            const response = await api.post('/admin/storage/cleanup-temp');
            const result = response.data.result;
            alert(`Cleanup completed! Removed ${result.deletedCount} files, freed ${result.freedSpace} MB`);
            await loadStorageInfo(); // Refresh storage info
        } catch (error) {
            console.error('Cleanup temp files error:', error);
            alert('Failed to cleanup temporary files');
        }
    };

    const handleOptimizeStorage = async () => {
        if (!window.confirm('Optimize storage by removing orphaned files? This may take a few minutes.')) return;

        try {
            const response = await api.post('/admin/storage/optimize');
            const result = response.data.result;
            const message = `Optimization completed!\n` +
                          `Orphaned files: ${result.orphanedFiles.deletedCount} removed, ${result.orphanedFiles.freedSpace} MB freed\n` +
                          `Compressed assets: ${result.compression.compressedCount}`;
            alert(message);
            await loadStorageInfo(); // Refresh storage info
        } catch (error) {
            console.error('Optimize storage error:', error);
            alert('Failed to optimize storage');
        }
    };

    const handleGenerateStorageReport = async () => {
        try {
            const format = window.prompt('Report format (json/csv):', 'json');
            if (!format) return;

            const period = window.prompt('Report period in days:', '30');
            if (!period) return;

            if (format.toLowerCase() === 'csv') {
                // Download CSV file
                const response = await api.get(`/admin/storage/report?format=csv&period=${period}`, {
                    responseType: 'blob'
                });
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `storage-report-${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                window.URL.revokeObjectURL(url);
            } else {
                // Show JSON report
                const response = await api.get(`/admin/storage/report?format=json&period=${period}`);
                const report = response.data.result;
                console.log('Storage Report:', report);
                alert(`Storage report generated successfully! Check browser console for details.\n\nSummary:\nTotal files: ${report.bucket.totalFiles}\nTotal size: ${report.bucket.totalSize} GB`);
            }
        } catch (error) {
            console.error('Generate storage report error:', error);
            alert('Failed to generate storage report');
        }
    };

    if (loading) return <div className="p-6">Loading admin dashboard...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    return (
      <div className='p-6 space-y-6'>
        {/* Admin Header */}
        <div className="flex justify-between items-center">
          <h1 className='text-2xl font-bold text-gray-900'>Admin Dashboard</h1>
          <div className="flex space-x-2">
            <Button onClick={handleRefreshSystemStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Stats Overview */}
        {stats && (
          <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6'>
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
              <h3 className='text-lg font-semibold mb-2'>Completed Jobs</h3>
              <p className='text-2xl font-bold text-green-600'>
                {stats.jobStats?.COMPLETED?.count || 0}
              </p>
            </Card>
            <Card className='p-4'>
              <h3 className='text-lg font-semibold mb-2'>Failed Jobs</h3>
              <p className='text-2xl font-bold text-red-600'>
                {stats.jobStats?.FAILED?.count || 0}
              </p>
            </Card>
          </div>
        )}

        {/* Admin Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'System Status', icon: Activity },
              { id: 'jobs', label: 'Job Management', icon: BarChart3 },
              { id: 'storage', label: 'Storage Management', icon: Database },
              { id: 'users', label: 'User Management', icon: Users }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 cursor-pointer`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  System Status
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Processing Queue:</span>
                    <span className="font-medium">{systemStatus?.status?.queue?.queuedJobs || 0} jobs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Jobs:</span>
                    <span className="font-medium">{systemStatus?.status?.queue?.activeJobs || 0}/{systemStatus?.status?.queue?.maxConcurrentJobs || 2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cache Status:</span>
                    <span className={`font-medium ${systemStatus?.status?.systemHealth?.cache?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                      {systemStatus?.status?.systemHealth?.cache?.status === 'connected' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Database:</span>
                    <span className={`font-medium ${systemStatus?.status?.systemHealth?.database?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                      {systemStatus?.status?.systemHealth?.database?.status === 'connected' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3 text-sm">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div key={activity.id || index} className="flex items-center space-x-2">
                        <div className={`w-2 h-2 bg-${activity.color}-500 rounded-full`}></div>
                        <span>{activity.activity}</span>
                        <span className="text-gray-500 ml-auto">{activity.timeAgo}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center py-4">
                      No recent activity
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Job Management</h3>
                <div className="flex space-x-2">
                  <Button onClick={handleRestartFailedJobs} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Failed Jobs
                  </Button>
                  <Button onClick={handleClearOldJobs} variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cleanup Old Jobs
                  </Button>
                </div>
              </div>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Recent Jobs</h4>
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">Job #{job.id}</div>
                        <div className="text-sm text-gray-600">{job.user_email}</div>
                        <div className="text-xs text-gray-500">
                          Status: <span className="font-medium">{job.status}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDeleteJob(job.id)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Storage Management</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h4 className="font-semibold mb-4 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Storage Overview
                  </h4>
                  {storageInfo && (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total Storage:</span>
                        <span className="font-medium">{storageInfo.totalStorage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Storage (MB):</span>
                        <span className="font-medium">{storageInfo.totalStorageMB || storageInfo.totalStorage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Recent Assets (30d):</span>
                        <span className="font-medium">{storageInfo.recentAssets || 0}</span>
                      </div>
                      {storageInfo.bucketName && (
                        <div className="flex justify-between">
                          <span>S3 Bucket:</span>
                          <span className="font-medium text-xs">{storageInfo.bucketName}</span>
                        </div>
                      )}
                      {storageInfo.lastUpdated && (
                        <div className="flex justify-between">
                          <span>Last Updated:</span>
                          <span className="font-medium text-xs">{new Date(storageInfo.lastUpdated).toLocaleTimeString()}</span>
                        </div>
                      )}
                      {storageInfo.error && (
                        <div className="text-red-600 text-sm mt-2">
                          <AlertTriangle className="h-4 w-4 inline mr-1" />
                          {storageInfo.error}
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Total Files:</span>
                        <span className="font-medium">{storageInfo.totalFiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Media Assets:</span>
                        <span className="font-medium">{storageInfo.mediaAssets}</span>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h4 className="font-semibold mb-4">Storage Actions</h4>
                  <div className="space-y-3">
                    <Button
                      onClick={handleCleanupTempFiles}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cleanup Temporary Files
                    </Button>
                    <Button
                      onClick={handleOptimizeStorage}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Optimize Storage
                    </Button>
                    <Button
                      onClick={handleGenerateStorageReport}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Generate Storage Report
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">User Management</h3>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">All Users</h4>
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{user.username || user.email}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="flex flex-col gap-1 mt-1">
                          {user.groups && user.groups.length > 0 && (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                              Role: {user.groups.join(', ')}
                            </span>
                          )}
                          {user.status && (
                            <span className={`inline-block px-2 py-1 text-xs rounded ${
                              user.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              Status: {user.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {user.role !== 'admin' && (
                          <Button
                            onClick={() => handlePromoteToAdmin(user.email)}
                            size="sm"
                            variant="outline"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Make Admin
                          </Button>
                        )}
                        <Button
                          onClick={() => handleViewPermissions(user.email)}
                          size="sm"
                          variant="outline"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Permissions
                        </Button>
                        <Button
                          onClick={() => handleDeleteUser(user.id)}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
};

export default AdminDashboard;