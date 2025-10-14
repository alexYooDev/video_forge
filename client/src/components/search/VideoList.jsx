import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { Download, ChevronRight } from "lucide-react";

const VideoList = ({videos}) => {
    const navigate = useNavigate();

    const handleClickSelect = (video) => {
        const videoUrl = video.file;
        navigate('/', {state: { videoUrl }});
    }

    const formatTags = (tagArray) => {
        if (!tagArray || !tagArray[0]) return [];
        return tagArray[0].slice(0, 4); // Show max 4 tags
    }

    return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {videos.map((video) => (
                <Card
                    key={video.id}
                    className="group overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white border border-gray-200"
                >
                    {/* Video Thumbnail Section */}
                    <div className="relative overflow-hidden bg-gray-100 aspect-video">
                        <img 
                            src={video.thumbnail} 
                            alt="Video thumbnail"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                    </div>

                    {/* Video Info Section */}
                    <div className="p-3 space-y-3">
                        {/* Tags Section - Show only 2 tags */}
                        {formatTags(video.tags).length > 0 && (
                            <div className="flex flex-wrap gap-3">
                                {formatTags(video.tags).slice(0, 2).map((tag, index) => (
                                    <span 
                                        key={index}
                                        className=" bg-blue-50 text-blue-300 text-xs px-3 py-2 rounded-full font-medium"
                                    >
                                        {tag.trim()}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Action Button - Compact */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleClickSelect(video)}
                            className="w-full text-black font-medium py-2 mt-4 text-sm transition-all duration-200 shadow-sm hover:shadow-md group"
                        >
                            <div className="flex items-center justify-center gap-1">
                                <Download className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                                <span>Select</span>
                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}

export default VideoList;