import { useState } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import axios from 'axios';
import { useVideos } from "../../context/VideoContext";

import VideoList from "./VideoList";

const SearchBar = () => {

    const [searchWord, setSearchWord] = useState('');
    const { videos, setVideos } = useVideos();

    const handleChangeSearchWord = (e) => {
        setSearchWord(e.target.value)
    }

    const handleSubmitSearch = async (e) => {
        e.preventDefault();
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
        }
    }

    return (
      <Card>
        <form className='flex space-x-2 mb-4' onSubmit={handleSubmitSearch}>
          <input
            type='text'
            id='inputSource'
            name='inputSource'
            value={searchWord}
            onChange={handleChangeSearchWord}
            placeholder='Search by key word e.g.) Brisbane'
            className='flex-1 rounded-md border px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500'
          />
          <Button
            type='submit'
            variant='outline'
            className='whitespace-nowrap'
          >
            Search
          </Button>
        </form>
        {videos.length > 0 ? <VideoList videos={videos}/> : null }
      </Card>
    );
}

export default SearchBar;