import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Button from "../ui/Button";

const VideoList = ({videos}) => {

    const navigate = useNavigate();

    const handleClickDownload = (video) => {

        const videoUrl = video.file;

        navigate('/', {state: { videoUrl }})    
    }

    return (
      <div>
        {videos.map((video) => (
          <Card key={video.id}>
            <img src={video.thumbnail} width={200} height={200} alt='' />
            {/* {video.tags.map((tag) => (
              <span>{tag}</span>
            ))} */}
            <Button
              type='button'
              variant='outline'
              className='whitespace-nowrap mx-4 my-4'
              onClick={() => handleClickDownload(video)}
            >
              Download
            </Button>
          </Card>
        ))}
      </div>
    );
}

export default VideoList;