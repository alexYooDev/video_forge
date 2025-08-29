import { useVideos } from "../context/VideoContext";
import { Link } from "react-router-dom";

const VideoListPage = () => {
    const {videos} = useVideos();

    
    return (
      <main>
        <div>
          {videos.map((video) => (
            <div key={video.id}>
              <img src={video.thumbnail} width={200} height={200} alt='' />
              {video.tags.map((tag) => (
                <span>{tag}</span>
              ))}
              <Link to={{ pathname: '/download', state: { url: video.file } }}>
                Download
              </Link>
            </div>
          ))}
        </div>
      </main>
    );
    
}

export default VideoListPage;