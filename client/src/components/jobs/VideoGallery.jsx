import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const VideoGallery = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, public, my-videos

  // Edit modal state
  const [editingVideo, setEditingVideo] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', visibility: 'public' });
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation state
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    loadVideos();
  }, [filter]);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/gallery/videos', {
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

  const handleEditClick = (video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title || '',
      description: video.description || '',
      visibility: video.visibility || 'public'
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      const response = await api.put(`/gallery/videos/${editingVideo.id}`, editForm);

      // Update the video in the list
      setVideos(videos.map(v =>
        v.id === editingVideo.id
          ? { ...v, ...response.data }
          : v
      ));

      setEditingVideo(null);
      setEditForm({ title: '', description: '', visibility: 'public' });
    } catch (err) {
      console.error('Failed to update video:', err);
      alert(err.response?.data?.error || 'Failed to update video');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClick = (video) => {
    setDeletingVideo(video);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);

    try {
      await api.delete(`/gallery/videos/${deletingVideo.id}`);

      // Remove the video from the list
      setVideos(videos.filter(v => v.id !== deletingVideo.id));

      setDeletingVideo(null);
    } catch (err) {
      console.error('Failed to delete video:', err);
      alert(err.response?.data?.error || 'Failed to delete video');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isOwner = (video) => {
    return user && video.userId === user.sub;
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
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {videos.map((video) => (
            <div key={video.id} className='group'>
              <Card className='h-full hover:shadow-xl transition-shadow duration-200'>
                <div className='space-y-3'>
                  {/* Thumbnail - Clickable to video player */}
                  <Link to={`/video/${video.id}`}>
                    <div className='relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center cursor-pointer'>
                    {/* Actual thumbnail image if available */}
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title || 'Video thumbnail'}
                        className='w-full h-full object-cover'
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      /* Fallback icon for videos without thumbnails */
                      <svg
                        className='h-16 w-16 text-gray-600'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                      >
                        <path d='M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z' />
                      </svg>
                    )}

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
                  </Link>

                  {/* Video Info */}
                  <div>
                    <h3 className='font-bold text-black line-clamp-2'>
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

                  {/* Owner Actions */}
                  {isOwner(video) && (
                    <div className='flex gap-2 pt-2 border-t border-gray-200'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={(e) => {
                          e.preventDefault();
                          handleEditClick(video);
                        }}
                        className='flex-1'
                      >
                        <svg
                          className='h-4 w-4 mr-1'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                          />
                        </svg>
                        Edit
                      </Button>
                      <Button
                        size='sm'
                        variant='danger'
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteClick(video);
                        }}
                        className='flex-1'
                      >
                        <svg
                          className='h-4 w-4 mr-1'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                          />
                        </svg>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingVideo && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <h3 className='text-xl font-bold text-black mb-4'>Edit Video</h3>
            <form onSubmit={handleEditSubmit} className='space-y-4'>
              <div>
                <label className='block text-sm font-bold text-black mb-1'>
                  Title
                </label>
                <input
                  type='text'
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-bold text-black mb-1'>
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  rows='3'
                />
              </div>

              <div>
                <label className='block text-sm font-bold text-black mb-1'>
                  Visibility
                </label>
                <select
                  value={editForm.visibility}
                  onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='public'>Public</option>
                  <option value='private'>Private</option>
                </select>
              </div>

              <div className='flex gap-2 pt-4'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setEditingVideo(null)}
                  className='flex-1'
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  variant='primary'
                  className='flex-1'
                  loading={editLoading}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <div className='flex items-start space-x-3'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-6 w-6 text-red-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  />
                </svg>
              </div>
              <div className='flex-1'>
                <h3 className='text-lg font-bold text-black mb-2'>Delete Video</h3>
                <p className='text-sm text-black font-medium mb-4'>
                  Are you sure you want to delete "{deletingVideo.title || `Video ${deletingVideo.id}`}"?
                  This action cannot be undone.
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setDeletingVideo(null)}
                    className='flex-1'
                    disabled={deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant='danger'
                    onClick={handleDeleteConfirm}
                    className='flex-1'
                    loading={deleteLoading}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGallery;
