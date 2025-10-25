import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoUpload from './VideoUpload';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { SUPPORTED_FORMATS } from '../../utils/constants';
import { useJobs } from '../../hooks/useJobs';
import api from '../../services/api';

const UploadPage = () => {
  const navigate = useNavigate();
  const { createJob } = useJobs();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState(SUPPORTED_FORMATS); // Default to ALL qualities
  const [visibility, setVisibility] = useState('public');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleUploadComplete = (fileData) => {
    console.log('Upload complete:', fileData);
    setUploadedFile(fileData);
    // Set default title from filename
    setVideoTitle(fileData.filename.replace(/\.[^/.]+$/, ''));
  };

  const handleFormatToggle = (format) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const handleStartProcessing = async () => {
    if (!uploadedFile || selectedFormats.length === 0) return;

    setProcessing(true);
    try {
      // Step 1: Extract video metadata
      console.log('Extracting video metadata...');
      let metadata = {};
      try {
        const metadataResponse = await api.post('/metadata/extract', {
          s3Key: uploadedFile.s3Key
        });
        metadata = metadataResponse.data.metadata;
        console.log('Metadata extracted:', metadata);
      } catch (metadataError) {
        console.warn('Failed to extract metadata, continuing without it:', metadataError);
        // Continue even if metadata extraction fails
      }

      // Step 2: Confirm upload with gallery-service (with metadata)
      await api.post('/upload/confirm', {
        s3Key: uploadedFile.s3Key,
        title: videoTitle || uploadedFile.filename,
        description: videoDescription,
        visibility: visibility,
        metadata: metadata
      });

      // Step 3: Create transcoding job
      const result = await createJob({
        inputSource: uploadedFile.s3Key,
        outputFormats: selectedFormats,
        visibility: visibility,
        title: videoTitle || uploadedFile.filename,
        description: videoDescription
      });

      if (result.success) {
        alert('Video uploaded and processing started! Redirecting to gallery...');
        navigate('/gallery');
      } else {
        alert(`Failed to start processing: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8">
      {/* Header */}
      <h1 className="text-3xl font-bold mb-2 text-black">
        Upload & Share Video 📤
      </h1>
      <p className="text-black font-semibold">
        Upload your video, select formats, and share with the community
      </p>

      {/* Upload Section */}
      <VideoUpload onUploadComplete={handleUploadComplete} />

      {/* Processing Options */}
      {uploadedFile && (
        <Card>
          <h3 className="text-lg font-semibold text-black mb-6">
            Video Details & Processing
          </h3>

          <div className="space-y-6">
            {/* Uploaded File Info */}
            <div className="bg-green-50 border border-green-300 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">
                    Upload Complete ✓
                  </p>
                  <p className="text-xs text-green-700 font-medium">
                    {uploadedFile.filename} • {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>

            {/* Video Title */}
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                Video Title *
              </label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Enter a title for your video"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black font-medium"
                maxLength={100}
              />
              <p className="mt-1 text-xs text-black font-medium">
                {videoTitle.length}/100 characters
              </p>
            </div>

            {/* Video Description */}
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                Description (Optional)
              </label>
              <textarea
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black font-medium"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-black font-medium">
                {videoDescription.length}/500 characters
              </p>
            </div>

            {/* Visibility Control */}
            <div>
              <label className="block text-sm font-semibold text-black mb-3">
                Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className={`flex items-center p-4 border-2 rounded-lg transition-all ${
                      visibility === 'public'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <svg
                      className={`h-6 w-6 mr-3 ${
                        visibility === 'public' ? 'text-primary-600' : 'text-gray-500'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${visibility === 'public' ? 'text-primary-900' : 'text-black'}`}>
                        Public
                      </p>
                      <p className={`text-xs ${visibility === 'public' ? 'text-primary-700' : 'text-black'} font-medium`}>
                        Everyone can view
                      </p>
                    </div>
                  </div>
                </label>

                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className={`flex items-center p-4 border-2 rounded-lg transition-all ${
                      visibility === 'private'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <svg
                      className={`h-6 w-6 mr-3 ${
                        visibility === 'private' ? 'text-primary-600' : 'text-gray-500'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${visibility === 'private' ? 'text-primary-900' : 'text-black'}`}>
                        Private
                      </p>
                      <p className={`text-xs ${visibility === 'private' ? 'text-primary-700' : 'text-black'} font-medium`}>
                        Only you can view
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-semibold text-black mb-3">
                Output Formats *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SUPPORTED_FORMATS.map((format) => (
                  <label
                    key={format}
                    className="cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFormats.includes(format)}
                      onChange={() => handleFormatToggle(format)}
                      className="sr-only"
                    />
                    <div
                      className={`flex items-center justify-center text-sm font-bold rounded-lg py-3 px-4 border-2 transition-all ${
                        selectedFormats.includes(format)
                          ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                          : 'bg-white text-gray-900 border-gray-400 hover:border-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {format.toUpperCase()}
                    </div>
                  </label>
                ))}
              </div>
              {selectedFormats.length === 0 && (
                <p className="mt-2 text-sm text-red-600 font-semibold">
                  ⚠️ Please select at least one output format
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={handleStartProcessing}
                variant='primary'
                disabled={processing || selectedFormats.length === 0 || !videoTitle.trim()}
                loading={processing}
                className="flex-1 font-semibold bg-primary-600 hover:bg-primary-700 text-white border-2 border-primary-600"
              >
                {processing ? 'Starting Processing...' : '🚀 Start Processing'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setUploadedFile(null);
                  setVideoTitle('');
                  setVideoDescription('');
                }}
                disabled={processing}
                className="font-semibold bg-white text-gray-900 border-2 border-gray-400 hover:bg-gray-50 hover:border-gray-600"
              >
                Upload Another
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <h3 className="text-lg font-semibold text-black mb-4">
          📋 How It Works
        </h3>
        <ol className="space-y-3">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-600 text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
              1.
            </span>
            <span className="font-bold pt-0.5 text-black text-sm">Upload your video file (MP4, MOV, or AVI up to 500MB)</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-600 text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
              2.
            </span>
            <span className="font-bold pt-0.5 text-black text-sm">Add a title and description for your video</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-600 text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
              3.
            </span>
            <span className="font-bold pt-0.5 text-black text-sm">Choose visibility (public to share, or private for personal use)</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-600 text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
              4.
            </span>
            <span className="font-bold pt-0.5 text-black text-sm">Select output formats (4K, 1080p, 720p, 480p)</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-600 text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
              5.
            </span>
            <span className="font-bold pt-0.5 text-black text-sm">Click "Start Processing" and view your video in the gallery!</span>
          </li>
        </ol>
      </Card>
    </div>
  );
};

export default UploadPage;
