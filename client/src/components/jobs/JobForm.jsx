import React, { useEffect, useState } from 'react';
import { SUPPORTED_FORMATS } from '../../utils/constants';
import Button from '../ui/Button';
import Card from '../ui/Card';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';

const JobForm = ({ onSubmit, videoUrl, loading = false }) => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    inputSource: '',
    outputFormats: ['720p'],
  });

  const [errors, setErrors] = useState({});
  const [loadTestRunning, setLoadTestRunning] = useState(false);

  useEffect(() => {
    if (videoUrl && videoUrl !== '') {
      setFormData({...formData, inputSource: videoUrl});
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleFormatChange = (format) => {
    setFormData((prev) => ({
      ...prev,
      outputFormats: prev.outputFormats.includes(format)
        ? prev.outputFormats.filter((f) => f !== format)
        : [...prev.outputFormats, format],
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.inputSource.trim()) {
      newErrors.inputSource = 'Video URL is required';
    } else if (
      !formData.inputSource.startsWith('http') &&
      !formData.inputSource.startsWith('local-sample')
    ) {
      newErrors.inputSource =
        'Please enter a valid URL or use "local-sample.mp4" for testing';
    }

    if (formData.outputFormats.length === 0) {
      newErrors.outputFormats = 'At least one output format is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    await onSubmit(formData);

    // Reset form on successful submission
    setFormData({
      inputSource: '',
      outputFormats: ['720p'],
    });
  };

  const handleLoadTest = async () => {
    setLoadTestRunning(true);
    try {
      // Start load test and CPU monitoring
      const response = await api.post('/jobs/load-test', {
        concurrent: 5,
        videoUrl: 'local-sample.mp4',
        formats: ['1080p', '720p', '480p']
      });
      
      if (response.data.success) {
        alert('Load test started! Check CPU monitoring for results.');
      }
    } catch (error) {
      console.error('Load test failed:', error);
      alert('Load test failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadTestRunning(false);
    }
  };

  return (
    <Card>
      <h3 className='text-lg font-medium text-gray-900 mb-6'>Create New Job</h3>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Video URL Input */}
        <div>
          <label
            htmlFor='inputSource'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Video URL
          </label>
          <div className='flex space-x-2'>
            <input
              type='text'
              id='inputSource'
              name='inputSource'
              value={formData.inputSource}
              onChange={handleInputChange}
              placeholder='https://example.com/video.mp4 or local-sample.mp4'
              className={`flex-1 rounded-md border ${
                errors.inputSource ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500`}
            />
          </div>
          {errors.inputSource && (
            <p className='mt-1 text-sm text-red-600'>{errors.inputSource}</p>
          )}
          <p className='mt-1 text-sm text-gray-500'>
            Enter a video URL or use "local-sample.mp4" for testing
          </p>
        </div>

        {/* Output Formats */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-3'>
            Output Formats
          </label>
          <div className='flex gap-3'>
            {SUPPORTED_FORMATS.map((format) => (
              <label
                key={format}
                className={`flex-1 cursor-pointer`}
              >
                <input
                  type='checkbox'
                  checked={formData.outputFormats.includes(format)}
                  onChange={() => handleFormatChange(format)}
                  className='sr-only'
                />
                <div
                  className={`flex items-center justify-center text-sm font-medium rounded-lg py-3 px-4 border transition-colors ${
                    formData.outputFormats.includes(format)
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {format}
                </div>
              </label>
            ))}
          </div>
          {errors.outputFormats && (
            <p className='mt-1 text-sm text-red-600'>{errors.outputFormats}</p>
          )}
          <p className='mt-1 text-sm text-gray-500'>
            Select the formats you want to generate from your video
          </p>
        </div>

        {/* Submit Button */}
        <div className='flex justify-end space-x-3'>
          <Button
            type='button'
            variant='outline'
            onClick={() =>
              setFormData({ inputSource: '', outputFormats: ['720p'] })
            }
          >
            Reset
          </Button>
          <Button
            type='submit'
            variant='outline'
            loading={loading}
            disabled={
              !formData.inputSource.trim() ||
              formData.outputFormats.length === 0
            }
          >
            {loading ? 'Creating Job...' : 'Create Job'}
          </Button>
        </div>
      </form>

      {/* Quick Actions */}
      <div className='mt-6 pt-6 border-t border-gray-200'>
        <h4 className='text-sm font-medium text-gray-900 mb-3'>
          Quick Actions
        </h4>
        <div className='flex flex-wrap gap-3'>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setFormData({
                inputSource: 'local-sample.mp4',
                outputFormats: ['720p'],
              })
            }
          >
            Single Format Test
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setFormData({
                inputSource: 'local-sample.mp4',
                outputFormats: ['1080p', '720p', '480p'],
              })
            }
          >
            Multi-Format Test
          </Button>
          <Button
            size='sm'
            variant='danger'
            loading={loadTestRunning}
            onClick={handleLoadTest}
            disabled={loadTestRunning}
          >
            {loadTestRunning ? 'Running Load Test...' : 'Load Test & CPU Monitor'}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default JobForm;
