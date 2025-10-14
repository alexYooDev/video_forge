import { useState } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import axios from 'axios';
import { useVideos } from "../../context/VideoContext";
import { Search, Video, Play, Sparkles } from "lucide-react";

import VideoList from "./VideoList";

const SearchBar = () => {
    const [searchWord, setSearchWord] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { videos, setVideos } = useVideos();

    const handleChangeSearchWord = (e) => {
        setSearchWord(e.target.value)
    }

    const handleSubmitSearch = async (e) => {
        e.preventDefault();
        if (!searchWord.trim()) return;
        
        setIsLoading(true);
        const requestURL = `${process.env.REACT_APP_PIXABAY_BASE_URL}?key=${process.env.REACT_APP_PIXABAY_API_KEY}&q=${searchWord}`;
        try {
            const response = await axios.get(requestURL);
            const data = response.data;
            const videos = [];
            
            data.hits.forEach((video) => {
                videos.push({
                    id: video.id,
                    tags: [video.tags.split(', ')],
                    type: video.type,
                    thumbnail: video.videos.large.thumbnail,
                    file: video.videos.large.url,
                });
            });
            setVideos(videos);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    const popularSearches = ['nature', 'city', 'ocean', 'mountains', 'technology', 'people'];

    return (
        <div className="max-w-4xl mx-auto">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Discover Amazing Videos
                    </h1>
                    <p className="text-l text-gray-600 mb-8 max-w-2xl mx-auto">
                        Search through thousands of high-quality, royalty-free videos and transform them with our powerful processing tools.
                    </p>
                </div>

                {/* Search Section */}
                <Card className="mb-8 p-8 bg-gradient-to-br from-white to-gray-50 border-2 shadow-lg">
                    <form onSubmit={handleSubmitSearch} className="space-y-6">
                        <div className="flex gap-2">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="inputSource"
                                name="inputSource"
                                value={searchWord}
                                onChange={handleChangeSearchWord}
                                placeholder="What kind of videos are you looking for?"
                                className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 outline-none"
                                disabled={isLoading}
                            />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm text-gray-500 font-medium">Popular:</span>
                                {popularSearches.map((term) => (
                                    <button
                                        key={term}
                                        type="button"
                                        variant='outline'
                                        onClick={() => setSearchWord(term)}
                                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                            
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={isLoading || !searchWord.trim()}
                                className="px-8 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                {isLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        <span>Searching...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <Search className="h-5 w-5" />
                                        <span className="text-black">Search Videos</span>
                                    </div>
                                )}
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Results Section */}
                {isLoading && (
                    <Card className="mb-8 p-12 text-center">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-gray-900">Searching for videos...</h3>
                                <p className="text-gray-600">Finding the best matches for "{searchWord}"</p>
                            </div>
                        </div>
                    </Card>
                )}

                {!isLoading && videos.length === 0 && searchWord && (
                    <Card className="mb-8 p-12 text-center">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="bg-gray-100 p-6 rounded-full">
                                <Video className="h-12 w-12 text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-gray-900">No videos found</h3>
                                <p className="text-gray-600">Try searching with different keywords</p>
                            </div>
                        </div>
                    </Card>
                )}

                {!isLoading && videos.length === 0 && !searchWord && (
                    <Card className="mb-8 p-12 text-center bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                        <div className="flex flex-col items-center space-y-6">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-full">
                                <Sparkles className="h-12 w-12" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-gray-900">Ready to get started?</h3>
                                <p className="text-gray-600 max-w-md">
                                    Enter a search term above to discover thousands of high-quality videos ready for processing.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 space-x-6 text-sm text-gray-500">
                                <div className="flex items-center space-x-2">
                                    <Play className="h-4 w-4" />
                                    <span>HD Quality</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Video className="h-4 w-4" />
                                    <span>Multiple Formats</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Royalty Free</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
                {!isLoading && videos.length > 0 && (
                    <div className="space-y-6">
                        <VideoList videos={videos} />
                    </div>
                )}
            </div>
    );
}

export default SearchBar;