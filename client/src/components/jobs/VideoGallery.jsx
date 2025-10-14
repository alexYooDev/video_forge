import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import api from '../../services/api';

const VideoGallery = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, public, my-videos

  useEffect(() => {
    loadVideos();
  }, [filter]);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/gallery/videos', {
        params: {
          visibility: filter === 'public' ? 'public' : undefined,
          limit: 50
        }
      });

      setVideos(response.data.videos || []);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-sm font-semibold text-black">Loading videos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto py-8 space-y-6'>
      {/* Header */}
      <h1 className='text-3xl font-bold mb-2 text-black'>Video Gallery 🎬</h1>
      <p className='text-black font-semibold'>
        Browse and watch videos shared by the community
      </p>

      {/* Filter Tabs */}
      <Card>
        <div className='flex gap-2'>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-gray-100 text-black hover:bg-gray-200'
                : 'bg-primary-600 text-black shadow-md'
            }`}
          >
            All Videos
          </button>
          <button
            onClick={() => setFilter('public')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              filter === 'public'
                ? 'bg-gray-100 text-black hover:bg-gray-200'
                : 'bg-primary-600 text-black shadow-md'
            }`}
          >
            Public Only
          </button>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card>
          <div className='text-center py-8'>
            <svg
              className='mx-auto h-12 w-12 text-red-500'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <p className='mt-4 text-sm font-semibold text-red-700'>{error}</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!error && videos.length === 0 && (
        <Card>
          <div className='text-center py-12'>
            <svg
              className='mx-auto h-16 w-16 text-gray-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
            <h3 className='mt-4 text-lg font-bold text-black'>
              No videos found
            </h3>
            <p className='mt-2 text-sm font-medium text-black'>
              Be the first to upload and share a video!
            </p>
            <Link
              to='/upload'
              className='mt-4 inline-block px-6 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md'
            >
              Upload Video
            </Link>
          </div>
        </Card>
      )}

      {/* Video Grid */}
      {!error && videos.length > 0 && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
          {videos.map((video) => (
            <Link key={video.id} to={`/video/${video.id}`} className='group'>
              <Card className='h-full hover:shadow-xl transition-shadow duration-200'>
                <div className='space-y-3'>
                  {/* Thumbnail Placeholder */}
                  <div className='relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center'>
                    {/* Duration Badge */}
                    {video.duration && (
                      <span className='absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs font-bold px-2 py-1 rounded'>
                        {formatDuration(video.duration)}
                      </span>
                    )}

                    {/* Play Button Overlay */}
                    <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-40'>
                      <div className='bg-white rounded-full p-3 shadow-lg'>
                        <svg
                          className='h-8 w-8 text-primary-600'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path d='M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z' />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Video Info */}
                  <div>
                    <h3 className='font-bold text-black line-clamp-2 group-hover:text-primary-600 transition-colors'>
                      {video.title || `Video ${video.id}`}
                    </h3>
                    {video.description && (
                      <p className='mt-1 text-sm text-black font-medium line-clamp-2'>
                        {video.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className='flex items-center justify-between text-xs text-black font-semibold'>
                    <span>{video.resolution || 'Unknown'}</span>
                    <span>{formatDate(video.createdAt)}</span>
                  </div>

                  {/* Visibility Badge */}
                  {video.visibility === 'private' && (
                    <div className='inline-flex items-center px-2 py-1 bg-gray-100 text-black text-xs font-bold rounded'>
                      <svg
                        className='h-3 w-3 mr-1'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                      >
                        <path
                          fillRule='evenodd'
                          d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                      Private
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoGallery;
