import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import api from '../../services/api';

const VideoPlayer = ({ jobId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [availableQualities, setAvailableQualities] = useState([]);
  const [transcodingMessage, setTranscodingMessage] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const videoRef = useRef(null);

  const loadVideo = useCallback(async (quality) => {
    setLoading(true);
    setError(null);
    setTranscodingMessage(null);

    try {
      const response = await api.get(`/api/gallery/videos/${jobId}/stream`);

      // Handle successful response with stream URL
      setStreamUrl(response.data.streamUrl);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load video:', err);
      setError(err.response?.data?.error || 'Failed to load video');
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      loadVideo(selectedQuality);
    }
  }, [jobId, selectedQuality, loadVideo]);

  const handleQualityChange = (quality) => {
    setSelectedQuality(quality);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-sm font-bold text-black">Loading video...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Video Info Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-black">Video Player</h3>
            {videoInfo && (
              <p className="text-sm font-semibold text-black">
                {videoInfo.resolution} • {formatDuration(videoInfo.duration)}
              </p>
            )}
          </div>

          {/* Quality Info */}
          {videoInfo && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-black">Quality:</span>
              <span className="px-3 py-1 text-xs font-medium rounded bg-primary-600 text-black">
                {videoInfo.quality === 'original' ? 'Original' : videoInfo.quality}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64 bg-black rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="mt-4 text-sm font-bold text-white">Loading video...</p>
            </div>
          </div>
        )}

        {/* Transcoding Message */}
        {transcodingMessage && !loading && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <svg
                className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-yellow-800">{transcodingMessage}</p>
                {availableQualities.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-2">Available qualities:</p>
                    <div className="flex gap-2 flex-wrap">
                      {availableQualities.map((quality) => (
                        <button
                          key={quality}
                          onClick={() => handleQualityChange(quality)}
                          className="px-3 py-1.5 text-xs font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-2">
                      No qualities are ready yet. The video is still being processed.
                    </p>
                    <Button
                      variant='outline'
                      onClick={() => loadVideo(selectedQuality)}
                      className="px-4 py-2 text-xs font-medium bg-yellow-600 text-black rounded hover:bg-yellow-700 transition-colors"
                    >
                      🔄 Refresh
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <svg
                className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">{error}</p>
                {availableQualities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-700 mb-2">Try these qualities:</p>
                    <div className="flex gap-2 flex-wrap">
                      {availableQualities.map((quality) => (
                        <button
                          key={quality}
                          onClick={() => handleQualityChange(quality)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Player - only show when we have a valid stream URL */}
        {streamUrl && !loading && !error && !transcodingMessage && (
          <>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={streamUrl}
                controls
                className="w-full"
                controlsList="nodownload"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Video Controls Info */}
            <div className="text-xs font-semibold text-black text-center">
              Use the player controls to play, pause, adjust volume, and toggle fullscreen
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default VideoPlayer;
