import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import Card from '../ui/Card';
import Button from '../ui/Button';
import api from '../../services/api';

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVideoDetails();
  }, [id]);

  const loadVideoDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/gallery/videos/${id}`);
      setVideo(response.data);
    } catch (err) {
      console.error('Failed to load video:', err);
      setError(err.response?.data?.error || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);

    if (hrs > 0) {
      return `${hrs}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-sm font-semibold text-black">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
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
            <h3 className="mt-4 text-lg font-bold text-black">Video not found</h3>
            <p className="mt-2 text-sm font-medium text-black">
              {error || 'The video you are looking for does not exist or has been removed.'}
            </p>
            <Link
              to="/gallery"
              className="mt-6 inline-block px-6 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md"
            >
              Back to Gallery
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (video.status !== 'ready' && video.status !== 'uploaded') {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-yellow-500 animate-pulse"
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
            <h3 className="mt-4 text-lg font-bold text-black">Video is processing</h3>
            <p className="mt-2 text-sm font-medium text-black">
              This video is currently being processed. Status: {video.status}
            </p>
            <Link
              to="/gallery"
              className="mt-6 inline-block px-6 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md"
            >
              Back to Gallery
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      {/* Back Button */}
      <div>
        <Button
          variant="outline"
          onClick={() => navigate('/gallery')}
          className="font-semibold"
        >
          ← Back to Gallery
        </Button>
      </div>

      {/* Video Player */}
      <VideoPlayer jobId={id} />

      {/* Video Info */}
      <Card>
        <div className="space-y-4">
          {/* Title and Visibility */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-black">
                {video.title || `Video ${video.id}`}
              </h1>
              {video.visibility && (
                <div className="mt-2 inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 text-sm font-bold rounded-full">
                  {video.visibility === 'private' ? (
                    <>
                      <svg className="h-4 w-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Private
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Public
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div>
              <h3 className="text-sm font-bold text-black mb-2">Description</h3>
              <p className="text-sm text-black font-medium whitespace-pre-wrap">
                {video.description}
              </p>
            </div>
          )}

          {/* Video Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs font-bold text-black uppercase tracking-wide">Duration</p>
              <p className="mt-1 text-lg font-bold text-black">
                {formatDuration(video.duration)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-black uppercase tracking-wide">Resolution</p>
              <p className="mt-1 text-lg font-bold text-black">
                {video.resolution || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-black uppercase tracking-wide">Video Codec</p>
              <p className="mt-1 text-lg font-bold text-black">
                {video.videoCodec || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-black uppercase tracking-wide">Audio Codec</p>
              <p className="mt-1 text-lg font-bold text-black">
                {video.audioCodec || 'N/A'}
              </p>
            </div>
          </div>

          {/* Upload Date */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-bold text-black uppercase tracking-wide">Uploaded</p>
            <p className="mt-1 text-sm font-semibold text-black">
              {formatDate(video.createdAt)}
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card>
        <h3 className="text-lg font-bold text-black mb-4">Actions</h3>
        <div className="flex gap-3">
          <Link
            to={`/jobs/${id}`}
            className="px-6 py-2.5 bg-primary-600 text-black font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md"
          >
            View All Formats
          </Link>
          <Button
            variant="outline"
            onClick={() => navigate('/gallery')}
            className="font-semibold"
          >
            Browse More Videos
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VideoDetail;
