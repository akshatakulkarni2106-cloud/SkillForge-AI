import React from 'react'; import ReactDOM from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; import App from './App'; import { AuthProvider } from './context/AuthContext'; import { SettingsProvider } from './context/SettingsContext'; import './styles.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthProvider><SettingsProvider><App /><Toaster position="top-right" /></SettingsProvider></AuthProvider></BrowserRouter>);
