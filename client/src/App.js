import './App.css';
import SearchForm from './components/SearchForm';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useVideos } from './context/VideoContext';

function App() {

  const [searchString, setSearchString] = useState('');

  const { setVideos } = useVideos();

  const navigate = useNavigate();

  const handleChangeSearchString = (string) => {
    setSearchString(string);
  };

  const handleSubmitForm =  async (e) => {
    e.preventDefault();
    const requestURL = `${process.env.REACT_APP_PIXABAY_BASE_URL}?key=${process.env.REACT_APP_PIXABAY_API_KEY}&q=${searchString}`;
    try {
      const response = await fetch(requestURL);
      
      if (!response.ok) {
        throw new Error(`HTTP error, status: ${response.status}`);
      }
      const data = await response.json();

      const videos = [];
      
      data.hits.forEach((video) => {
        videos.push({
          id: video.id,
          tags: [video.tags.split(', ')],
          type: video.type,
          thumbnail: video.videos.large.thumbnail,
          file: video.videos.large.url
        })
      });

      setVideos(videos);
      setSearchString(null);
      navigate('/video-list');
      console.log(videos);
    } catch (err) {
      console.error(err);
    }

  }

  return (
    <div className="App">
        <main>
          <h1>Search and Download the free public videos in every scale!</h1>
          <SearchForm onChange={handleChangeSearchString} onSubmit={handleSubmitForm} searchString={searchString}/>
        </main>
    </div>
  );
}

export default App;
