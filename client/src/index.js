import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { VideoProvider } from './context/VideoContext';
import { AuthProvider } from './context/AuthProvider';

import Header from './components/layout/Header';
import JobList from './components/jobs/JobList';
import SearchVideo from './components/search/SearchVideo';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider>
    <BrowserRouter>
      <Header/>
      <VideoProvider>
        <Routes>
          <Route path='/' element={<App/>}/>
          <Route path='/jobs' element={<JobList/>} />
          <Route path='/search-video' element={<SearchVideo/>} />
        </Routes>
      </VideoProvider>
    </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
