import React from 'react';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';

const SystemStats = () => {
  const { systemStats, connectionStatus } = useRealtimeJobs(true);

  if (connectionStatus !== 'connected' || !systemStats.currentJobs) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-blue-800 mb-2">System Status</h4>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-blue-600 font-medium">{systemStats.currentJobs || 0}</div>
          <div className="text-blue-700">Active Jobs</div>
        </div>
        <div>
          <div className="text-blue-600 font-medium">{systemStats.queueLength || 0}</div>
          <div className="text-blue-700">Queued</div>
        </div>
        <div>
          <div className="text-blue-600 font-medium">{systemStats.maxConcurrent || 0}</div>
          <div className="text-blue-700">Max Concurrent</div>
        </div>
      </div>
    </div>
  );
};

export default SystemStats;