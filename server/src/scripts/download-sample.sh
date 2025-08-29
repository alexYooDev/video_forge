#!/bin/bash
echo "Downloading sample video for testing..."

SAMPLE_URL="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
OUTPUT_PATH="./data/inputs/sample-video.mp4"

if [ ! -f "$OUTPUT_PATH" ]; then
    curl -L "$SAMPLE_URL" -o "$OUTPUT_PATH"
    echo "Sample video downloaded to $OUTPUT_PATH"
else
    echo "Sample video already exists at $OUTPUT_PATH"
fi

# Test FFmpeg with sample
echo "Testing FFmpeg installation..."
ffmpeg -i "$OUTPUT_PATH" -t 5 -c copy "./data/temp/test-output.mp4" -y
if [ $? -eq 0 ]; then
    echo "FFmpeg test successful!"
    rm "./data/temp/test-output.mp4"
else
    echo "FFmpeg test failed!"
fi