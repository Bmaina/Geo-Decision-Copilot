
import React, { useState, useEffect, useRef } from 'react';
import { AppState, ChatMessage, MessageRole, BasemapType, UploadedLayer } from './types';
import { INITIAL_ANALYSIS_DATA } from './constants';
import { sendMessageToGemini } from './services/geminiService';
import MapPanel from './components/MapPanel';
import ChartsPanel from './components/ChartsPanel';
import { jsPDF } from "jspdf";
import Papa from "papaparse";

const SUGGESTED_QUERIES = [
    { label: "Select a strategic question...", value: "custom" },
    { category: "Risk Assessment", label: "Identify specific risks (Flood, Fire, Crime) for each location.", value: "Identify specific risks (Flood, Fire, Crime) for each location. What is the likelihood (Low/Med/High) and potential financial impact?" },
    { category: "Risk Assessment", label: "Are risks concentrated in specific geographic clusters?", value: "Analyze if risks are concentrated in specific geographic areas. Are there regional differences in risk exposure?" },
    { category: "Strategic Impact", label: "Which locations should be prioritized for mitigation vs divestment?", value: "Compare risk exposure to revenue contribution. Which locations should be prioritized for mitigation and which should be divested?" },
    { category: "Strategic Impact", label: "Identify underserved high-potential markets.", value: "Are there underserved areas with high demand and low supply? Identify geographic clusters of opportunity." },
    { category: "Market Dynamics", label: "Analyze competitor proximity and saturation.", value: "How close are competitors? Is the market saturated or are there gaps? Analyze the competition risk." },
    { category: "Market Dynamics", label: "Assess access and infrastructure risks.", value: "Analyze access risks: Will traffic patterns, construction, or new routes affect these locations?" },
    { category: "Correlations", label: "How does geography correlate with performance?", value: "How does geography correlate with business performance? Are there clusters of high-performing indicators?" },
    { category: "Custom", label: "✍️ Write my own question", value: "custom" }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    messages: [
      {
        id: 'init',
        role: MessageRole.MODEL,
        text: INITIAL_ANALYSIS_DATA.markdownResponse,
        timestamp: new Date(),
        analysis: INITIAL_ANALYSIS_DATA
      }
    ],
    isLoading: false,
    isCleaning: false,
    currentAnalysis: INITIAL_ANALYSIS_DATA,
    activeTab: 'map',
    basemap: 'gray', // Changed default to gray for professional look
    uploadedLayers: [],
    showDataManager: false,
    isHeatmapMode: false
  });

  const [input, setInput] = useState('');
  const [dataUrl, setDataUrl] = useState(''); // For ArcGIS/Web URL import
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // For image upload
  const [selectedSuggestion, setSelectedSuggestion] = useState('custom');
  
  // State for thumbnail modal is no longer needed as we download directly
  // but we can keep a loading state for it if complex, but canvas is fast.

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // --- Handlers ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachedImage(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSuggestionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSelectedSuggestion(val);
      if (val === 'custom') {
          setInput('');
      } else {
          setInput(val);
      }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || state.isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: input,
      image: attachedImage || undefined,
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));

    setInput('');
    setAttachedImage(null);
    setSelectedSuggestion('custom'); // Reset dropdown

    // Call API with uploaded context and potential image
    const analysisResult = await sendMessageToGemini(
        state.messages, 
        userMessage.text || "Analyze this image", 
        state.uploadedLayers,
        userMessage.image
    );

    const botMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: MessageRole.MODEL,
      text: analysisResult.markdownResponse,
      timestamp: new Date(),
      analysis: analysisResult
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, botMessage],
      currentAnalysis: analysisResult,
      isLoading: false
    }));
  };

  const handleLoadSampleData = () => {
      setState(prev => ({ ...prev, isCleaning: true, showDataManager: false }));
      
      setTimeout(() => {
          const sampleLayer: UploadedLayer = {
              id: Date.now().toString(),
              name: 'Retail Network (Sample)',
              type: 'csv',
              data: [
                  { id: 's1', name: 'Downtown Flagship', lat: 47.6062, lng: -122.3321, score: 0, type: 'user-data', description: 'Traffic: High | Rev: $4.2M' },
                  { id: 's2', name: 'Capitol Hill Hub', lat: 47.6152, lng: -122.3211, score: 0, type: 'user-data', description: 'Traffic: Med | Rev: $2.1M' },
                  { id: 's3', name: 'South Lake Union', lat: 47.6253, lng: -122.3382, score: 0, type: 'user-data', description: 'Traffic: High | Rev: $3.8M' },
                  { id: 's4', name: 'Ballard Express', lat: 47.6687, lng: -122.3848, score: 0, type: 'user-data', description: 'Traffic: Low | Rev: $1.2M' },
                  { id: 's5', name: 'University Village', lat: 47.6620, lng: -122.2960, score: 0, type: 'user-data', description: 'Traffic: High | Rev: $3.5M' },
                  { id: 's6', name: 'West Seattle', lat: 47.5615, lng: -122.3870, score: 0, type: 'user-data', description: 'Traffic: Med | Rev: $1.9M' },
                  { id: 's7', name: 'Bellevue Square', lat: 47.6175, lng: -122.2023, score: 0, type: 'user-data', description: 'Traffic: V.High | Rev: $5.1M' },
                  { id: 's8', name: 'Redmond Town Center', lat: 47.6729, lng: -122.1223, score: 0, type: 'user-data', description: 'Traffic: Med | Rev: $2.4M' },
                  { id: 's9', name: 'Lynnwood Mall', lat: 47.8279, lng: -122.2827, score: 0, type: 'user-data', description: 'Traffic: High | Rev: $3.1M' },
                  { id: 's10', name: 'Southcenter', lat: 47.4593, lng: -122.2570, score: 0, type: 'user-data', description: 'Traffic: High | Rev: $3.9M' },
                  { id: 's11', name: 'Tacoma Mall', lat: 47.2185, lng: -122.4660, score: 0, type: 'user-data', description: 'Traffic: Med | Rev: $2.2M' },
                  { id: 's12', name: 'Northgate', lat: 47.7064, lng: -122.3256, score: 0, type: 'user-data', description: 'Traffic: Med | Rev: $1.8M' }
              ],
              rawSnippet: "id,name,lat,lng,revenue,traffic\n1,Downtown,47.60,-122.33,4.2M,High...",
              visible: true,
              color: '#10b981', // Emerald
              radius