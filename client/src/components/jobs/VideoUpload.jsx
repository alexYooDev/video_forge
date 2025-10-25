import React, { useState, useCallback } from 'react';
import axios from 'axios';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import api from '../../services/api';

const VideoUpload = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (selectedFile) => {
    setError(null);

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please select a valid video file (MP4, MOV, or AVI)');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size must be less than 500MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get pre-signed URL from gallery-service
      const response = await api.post('/upload/generate-url', {
        filename: file.name,
        contentType: file.type
      });

      const { uploadUrl, s3Key } = response.data;

      // Step 2: Upload to S3 using axios
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type
          // Don't send x-amz-server-side-encryption - let bucket default handle it
        },
        onUploadProgress: (progressEvent) => {
          const percentComplete = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
          );
          setProgress(percentComplete);
        }
      });

      // Step 3: Notify parent component
      if (onUploadComplete) {
        onUploadComplete({
          s3Key,
          filename: file.name,
          size: file.size
        });
      }

      // Reset
      setFile(null);
      setProgress(0);
      setUploading(false);

    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <h3 className="text-lg font-medium text-black mb-4">Upload Video</h3>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm font-semibold text-black">
              Drag and drop your video here, or click to browse
            </p>
            <input
              type="file"
              className="hidden"
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileInput}
              id="video-upload"
            />
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => document.getElementById('video-upload').click()}
            >
              Select Video
            </Button>
            <p className="mt-2 text-xs font-semibold text-black">
              MP4, MOV, or AVI up to 500MB
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg
                  className="h-10 w-10 text-primary-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-bold text-black">{file.name}</p>
                  <p className="text-xs font-semibold text-black">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!uploading && (
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-black"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            {uploading && (
              <div>
                <ProgressBar progress={progress} />
                <p className="mt-2 text-sm font-bold text-black">
                  Uploading... {progress}%
                </p>
              </div>
            )}

            {!uploading && (
              <Button onClick={handleUpload} variant='outline' className="w-full">
                Upload Video
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-md">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}
    </Card>
  );
};

export default VideoUpload;
