import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Image as ImageIcon, Wand2, Download, Sparkles, Coins, History, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHistory, saveHistoryItem, deleteHistoryItem, HistoryItem } from './lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRESETS = [
  { id: 'cyberpunk', label: 'Cyberpunk', keywords: 'cyberpunk style, neon lights, high contrast, futuristic, rain, reflections' },
  { id: 'synthwave', label: 'Synthwave', keywords: 'synthwave, retrowave, 80s aesthetic, purple and orange grid, glowing sun' },
  { id: 'anime', label: 'Anime', keywords: 'anime style, studio ghibli, highly detailed, vibrant colors, cel shaded' },
  { id: 'photorealistic', label: 'Realistic', keywords: 'photorealistic, 8k resolution, highly detailed, cinematic lighting, sharp focus' },
  { id: 'neon_noir', label: 'Neon Noir', keywords: 'neon noir, dark moody lighting, cinematic, film grain' },
];

export default function App() {
  const [prompt, setPrompt] = useState(
    'Ultra-detailed female model in cyberpunk style, futuristic street environment at night, neon lights, holographic ads, дождь, мокрий асфальт з відблисками неону, cinematic lighting, 4K realism.\n\nYoung woman, sharp facial features, glowing cybernetic implants on temples and neck, subtle face tattoos, коротке асиметричне волосся з неоновими пасмами (electric blue + magenta), впевнений погляд.\n\nOutfit: high-tech leather jacket with glowing seams, transparent holographic elements, tactical crop top, techwear pants with metallic деталей, кібернетична рука з підсвіткою.\n\nAtmosphere: Blade Runner inspired мегаполіс, голографічні білборди, азійський футуристичний квартал, туман, пар із люків, light rain particles, volumetric lighting, depth of field, ultra realistic skin texture, fashion photoshoot, sharp focus.\n\nCamera: low angle shot, 85mm lens, shallow depth of field, cinematic color grading, high contrast neon palette (purple, cyan, pink).'
  );
  const [editPrompt, setEditPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(10);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // Load credits
    const savedCredits = localStorage.getItem('cyberpunk_credits');
    if (savedCredits !== null) {
      setCredits(parseInt(savedCredits, 10));
    }

    // Load history
    getHistory().then(setHistory).catch(console.error);
  }, []);

  const deductCredit = () => {
    const newCredits = credits - 1;
    setCredits(newCredits);
    localStorage.setItem('cyberpunk_credits', newCredits.toString());
  };

  const applyPreset = (keywords: string) => {
    if (prompt.includes(keywords)) return;
    setPrompt((prev) => prev ? `${prev}, ${keywords}` : keywords);
  };

  const extractImageFromResponse = (response: any) => {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || credits <= 0) {
      if (credits <= 0) setError("Out of credits! (This is a demo)");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });
      
      const imageUrl = extractImageFromResponse(response);
      if (imageUrl) {
        setImage(imageUrl);
        deductCredit();
        
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          imageUrl,
          prompt,
          timestamp: Date.now()
        };
        await saveHistoryItem(newItem);
        setHistory(prev => [newItem, ...prev]);
      } else {
        setError('No image was generated. Please try a different prompt.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim() || !image || credits <= 0) {
      if (credits <= 0) setError("Out of credits! (This is a demo)");
      return;
    }
    setIsEditing(true);
    setError(null);
    try {
      const match = image.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid image format');
      }
      const mimeType = match[1];
      const base64Data = match[2];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: editPrompt,
            },
          ],
        },
      });

      const imageUrl = extractImageFromResponse(response);
      if (imageUrl) {
        setImage(imageUrl);
        setEditPrompt('');
        deductCredit();

        const newItem: HistoryItem = {
          id: Date.now().toString(),
          imageUrl,
          prompt: `Edited: ${editPrompt}`,
          timestamp: Date.now()
        };
        await saveHistoryItem(newItem);
        setHistory(prev => [newItem, ...prev]);
      } else {
        setError('No image was generated during edit. Please try a different prompt.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to edit image.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHistoryItem(id);
    setHistory(prev => prev.filter(item => item.id !== id));
    if (image && history.find(h => h.id === id)?.imageUrl === image) {
      // Optional: clear current image if deleted from history
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setImage(item.imageUrl);
    if (!item.prompt.startsWith('Edited:')) {
      setPrompt(item.prompt);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans selection:bg-pink-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center justify-center p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl"
            >
              <Sparkles className="w-6 h-6 text-pink-500" />
            </motion.div>
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"
              >
                Cyberpunk Vision
              </motion.h1>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-2 shadow-lg"
          >
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-medium text-sm">{credits} Credits</span>
            {credits === 0 && (
              <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full ml-2">Empty</span>
            )}
          </motion.div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium flex items-center gap-2 text-zinc-200">
                  <Wand2 className="w-5 h-5 text-cyan-400" />
                  Generate
                </h2>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Quick Styles</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.keywords)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-cyan-500" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-48 md:h-64 bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none text-zinc-300 placeholder:text-zinc-600 transition-all"
                placeholder="Describe the image you want to generate..."
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || credits <= 0}
                className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-3.5 px-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Image (1 Credit)'
                )}
              </button>
            </motion.div>

            <AnimatePresence>
              {image && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 space-y-4 shadow-2xl overflow-hidden"
                >
                  <h2 className="text-lg font-medium flex items-center gap-2 text-zinc-200">
                    <ImageIcon className="w-5 h-5 text-pink-400" />
                    Edit Image
                  </h2>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full h-24 bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none resize-none text-zinc-300 placeholder:text-zinc-600 transition-all"
                    placeholder="E.g., Add a retro filter, remove the person in the background..."
                  />
                  <button
                    onClick={handleEdit}
                    disabled={isEditing || !editPrompt.trim() || credits <= 0}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3.5 px-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    {isEditing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Applying Edits...
                      </>
                    ) : (
                      'Apply Edit (1 Credit)'
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Image Display */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-7 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-2 flex flex-col items-center justify-center min-h-[400px] lg:min-h-[600px] shadow-2xl relative group"
          >
            {image ? (
              <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden bg-zinc-950/50">
                <img
                  src={image}
                  alt="Generated Cyberpunk Vision"
                  className="max-w-full max-h-[800px] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
                <a
                  href={image}
                  download="cyberpunk-vision.png"
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-3 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 border border-white/10"
                  title="Download Image"
                >
                  <Download className="w-5 h-5" />
                </a>
                {(isGenerating || isEditing) && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-600 flex flex-col items-center gap-4 p-12 text-center">
                <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                  <ImageIcon className="w-10 h-10 opacity-50" />
                </div>
                <p className="text-lg font-medium text-zinc-400">No Image Generated Yet</p>
                <p className="text-sm max-w-sm">
                  Click the "Generate Image" button to create your cyberpunk masterpiece.
                </p>
                {isGenerating && (
                  <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                      <p className="text-cyan-400 font-medium animate-pulse">Synthesizing pixels...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* History Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-8 border-t border-zinc-800/50"
        >
          <h2 className="text-xl font-medium flex items-center gap-2 text-zinc-200 mb-6">
            <History className="w-5 h-5 text-purple-400" />
            Generation History
          </h2>
          
          {history.length === 0 ? (
            <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 text-center">
              No history yet. Your generated images will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <AnimatePresence>
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer"
                    onClick={() => loadFromHistory(item)}
                  >
                    <img 
                      src={item.imageUrl} 
                      alt="History item" 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <p className="text-xs text-zinc-300 line-clamp-2 mb-2">{item.prompt}</p>
                      <button
                        onClick={(e) => handleDeleteHistory(item.id, e)}
                        className="self-end p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                        title="Delete from history"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
