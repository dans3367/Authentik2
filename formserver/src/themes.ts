export interface ThemeStyles {
  id: string;
  name: string;
  container: string;
  card: string;
  header: string;
  title: string;
  description: string;
  label: string;
  input: string;
  textarea: string;
  select: string;
  radio: string;
  checkbox: string;
  button: string;
  background: string;
}

export const themes: Record<string, ThemeStyles> = {
  'modern': {
    id: 'modern',
    name: 'Modern',
    container: 'min-h-screen py-8',
    card: 'bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200',
    header: 'p-6 border-b border-gray-100',
    title: 'text-2xl font-bold text-gray-900',
    description: 'text-gray-600 mt-2',
    label: 'text-sm font-medium text-gray-700',
    input: 'w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    radio: 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300',
    checkbox: 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded',
    button: 'w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
  },
  
  'neon': {
    id: 'neon',
    name: 'Neon',
    container: 'min-h-screen py-8',
    card: 'bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-lg border-2 border-cyan-400 shadow-cyan-400/20',
    header: 'p-6 border-b border-cyan-400/30',
    title: 'text-2xl font-bold text-cyan-400 tracking-wide',
    description: 'text-gray-300 mt-2',
    label: 'text-sm font-medium text-green-400',
    input: 'w-full px-4 py-3 bg-gray-900 border-2 border-cyan-400 rounded-lg text-cyan-100 placeholder-gray-400 transition-all duration-200 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-gray-900 border-2 border-cyan-400 rounded-lg text-cyan-100 placeholder-gray-400 transition-all duration-200 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-gray-900 border-2 border-cyan-400 rounded-lg text-cyan-100 transition-all duration-200 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 focus:outline-none',
    radio: 'h-4 w-4 text-cyan-400 focus:ring-cyan-400 border-cyan-400',
    checkbox: 'h-4 w-4 text-cyan-400 focus:ring-cyan-400 border-cyan-400 rounded',
    button: 'w-full bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 text-black font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-400/30 hover:shadow-xl hover:shadow-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-black'
  },

  'nature': {
    id: 'nature',
    name: 'Nature',
    container: 'min-h-screen py-8',
    card: 'bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border-2 border-green-300',
    header: 'p-6 border-b border-green-200',
    title: 'text-2xl font-bold text-green-800',
    description: 'text-green-600 mt-2',
    label: 'text-sm font-medium text-green-700',
    input: 'w-full px-4 py-3 bg-white border-2 border-green-300 rounded-2xl transition-all duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-white border-2 border-green-300 rounded-2xl transition-all duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-white border-2 border-green-300 rounded-2xl transition-all duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none',
    radio: 'h-4 w-4 text-green-600 focus:ring-green-500 border-green-300',
    checkbox: 'h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded',
    button: 'w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50'
  },

  'luxury': {
    id: 'luxury',
    name: 'Luxury',
    container: 'min-h-screen py-8',
    card: 'bg-purple-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-yellow-400',
    header: 'p-6 border-b border-yellow-400/30',
    title: 'text-2xl font-light text-yellow-400 tracking-widest font-serif',
    description: 'text-purple-200 mt-2 font-light',
    label: 'text-sm font-medium text-yellow-300',
    input: 'w-full px-4 py-3 bg-purple-800/50 border border-yellow-400 rounded text-white placeholder-purple-300 transition-all duration-200 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-purple-800/50 border border-yellow-400 rounded text-white placeholder-purple-300 transition-all duration-200 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-purple-800/50 border border-yellow-400 rounded text-white transition-all duration-200 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none',
    radio: 'h-4 w-4 text-yellow-400 focus:ring-yellow-400 border-yellow-400',
    checkbox: 'h-4 w-4 text-yellow-400 focus:ring-yellow-400 border-yellow-400 rounded',
    button: 'w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-purple-900 font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900'
  },

  'glassmorphism': {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    container: 'min-h-screen py-8',
    card: 'bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20',
    header: 'p-6 border-b border-white/20',
    title: 'text-2xl font-semibold text-white tracking-wide',
    description: 'text-white/80 mt-2',
    label: 'text-sm font-medium text-white/90',
    input: 'w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl text-white placeholder-white/50 transition-all duration-200 focus:border-white/50 focus:ring-2 focus:ring-white/20 focus:outline-none shadow-inner shadow-black/10',
    textarea: 'w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl text-white placeholder-white/50 transition-all duration-200 focus:border-white/50 focus:ring-2 focus:ring-white/20 focus:outline-none shadow-inner shadow-black/10 resize-none',
    select: 'w-full px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl text-white transition-all duration-200 focus:border-white/50 focus:ring-2 focus:ring-white/20 focus:outline-none',
    radio: 'h-4 w-4 text-white focus:ring-white/50 border-white/50',
    checkbox: 'h-4 w-4 text-white focus:ring-white/50 border-white/50 rounded',
    button: 'w-full bg-white/20 backdrop-blur-xl hover:bg-white/30 text-white font-semibold py-4 px-6 rounded-2xl border border-white/30 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500'
  },

  'professional': {
    id: 'professional',
    name: 'Professional',
    container: 'min-h-screen py-8',
    card: 'bg-white rounded-md shadow-md border border-gray-300',
    header: 'p-6 border-b border-gray-200',
    title: 'text-2xl font-semibold text-blue-600',
    description: 'text-gray-600 mt-2',
    label: 'text-sm font-medium text-gray-700',
    input: 'w-full px-3 py-2 bg-white border border-gray-300 rounded-md transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    textarea: 'w-full px-3 py-2 bg-white border border-gray-300 rounded-md transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none',
    select: 'w-full px-3 py-2 bg-white border border-gray-300 rounded-md transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    radio: 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300',
    checkbox: 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded',
    button: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    background: 'bg-gray-50'
  },

  'retro': {
    id: 'retro',
    name: 'Retro',
    container: 'min-h-screen py-8',
    card: 'bg-yellow-50 rounded border-4 border-orange-400',
    header: 'p-6 border-b-4 border-orange-400',
    title: 'text-2xl font-black text-orange-600 tracking-wider uppercase transform -skew-x-12',
    description: 'text-orange-700 mt-2 font-bold',
    label: 'text-sm font-bold text-orange-700 uppercase',
    input: 'w-full px-4 py-3 bg-yellow-50 border-4 border-orange-400 rounded-none transition-all duration-200 focus:border-pink-400 focus:outline-none font-bold',
    textarea: 'w-full px-4 py-3 bg-yellow-50 border-4 border-orange-400 rounded-none transition-all duration-200 focus:border-pink-400 focus:outline-none font-bold resize-none',
    select: 'w-full px-4 py-3 bg-yellow-50 border-4 border-orange-400 rounded-none transition-all duration-200 focus:border-pink-400 focus:outline-none font-bold',
    radio: 'h-4 w-4 text-orange-500 focus:ring-orange-400 border-orange-400',
    checkbox: 'h-4 w-4 text-orange-500 focus:ring-orange-400 border-orange-400',
    button: 'w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-black py-4 px-6 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none uppercase tracking-wider',
    background: 'bg-gradient-to-br from-yellow-200 via-orange-200 to-pink-200'
  },

  'minimal': {
    id: 'minimal',
    name: 'Minimal',
    container: 'min-h-screen py-8',
    card: 'bg-white rounded-lg shadow-sm border border-gray-100',
    header: 'p-6',
    title: 'text-2xl font-light text-gray-800 tracking-wide',
    description: 'text-gray-500 mt-2 font-light',
    label: 'text-sm font-normal text-gray-600',
    input: 'w-full px-3 py-2 bg-white border-b border-gray-200 transition-colors duration-200 focus:border-gray-400 focus:outline-none',
    textarea: 'w-full px-3 py-2 bg-white border-b border-gray-200 transition-colors duration-200 focus:border-gray-400 focus:outline-none resize-none',
    select: 'w-full px-3 py-2 bg-white border-b border-gray-200 transition-colors duration-200 focus:border-gray-400 focus:outline-none',
    radio: 'h-4 w-4 text-gray-600 focus:ring-gray-400 border-gray-300',
    checkbox: 'h-4 w-4 text-gray-600 focus:ring-gray-400 border-gray-300 rounded',
    button: 'w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    background: 'bg-white'
  },

  'aurora': {
    id: 'aurora',
    name: 'Aurora',
    container: 'min-h-screen py-8',
    card: 'bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-200',
    header: 'p-6 border-b border-purple-100',
    title: 'text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent',
    description: 'text-gray-600 mt-2',
    label: 'text-sm font-medium text-purple-700',
    input: 'w-full px-4 py-3 bg-white/80 border-2 border-purple-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-white/80 border-2 border-purple-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-white/80 border-2 border-purple-200 rounded-xl backdrop-blur-sm transition-all duration-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 focus:outline-none',
    radio: 'h-4 w-4 text-purple-600 focus:ring-purple-500 border-purple-300',
    checkbox: 'h-4 w-4 text-purple-600 focus:ring-purple-500 border-purple-300 rounded',
    button: 'w-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50'
  },

  'cosmic': {
    id: 'cosmic',
    name: 'Cosmic',
    container: 'min-h-screen py-8',
    card: 'bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-lg border-2 border-indigo-400 shadow-indigo-400/20',
    header: 'p-6 border-b border-indigo-400/30',
    title: 'text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-wide',
    description: 'text-gray-300 mt-2',
    label: 'text-sm font-medium text-cyan-400',
    input: 'w-full px-4 py-3 bg-gray-900 border-2 border-indigo-400 rounded-lg text-cyan-100 placeholder-gray-400 transition-all duration-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-gray-900 border-2 border-indigo-400 rounded-lg text-cyan-100 placeholder-gray-400 transition-all duration-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-gray-900 border-2 border-indigo-400 rounded-lg text-cyan-100 transition-all duration-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none',
    radio: 'h-4 w-4 text-indigo-400 focus:ring-indigo-400 border-indigo-400',
    checkbox: 'h-4 w-4 text-indigo-400 focus:ring-indigo-400 border-indigo-400 rounded',
    button: 'w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-400/30 hover:shadow-xl hover:shadow-indigo-400/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900'
  },

  'elegant': {
    id: 'elegant',
    name: 'Elegant',
    container: 'min-h-screen py-8',
    card: 'bg-white rounded-lg shadow-xl border border-gray-200',
    header: 'p-8 border-b border-gray-100',
    title: 'text-3xl font-serif text-gray-800 tracking-tight',
    description: 'text-gray-600 mt-3 font-light leading-relaxed',
    label: 'text-sm font-semibold text-gray-700 uppercase tracking-wide',
    input: 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg transition-all duration-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-400/10 focus:outline-none focus:bg-white',
    textarea: 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg transition-all duration-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-400/10 focus:outline-none focus:bg-white resize-none',
    select: 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg transition-all duration-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-400/10 focus:outline-none focus:bg-white',
    radio: 'h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300',
    checkbox: 'h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300 rounded',
    button: 'w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-300 transform hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gray-100'
  },

  'playful': {
    id: 'playful',
    name: 'Playful',
    container: 'min-h-screen py-8',
    card: 'bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-4 border-pink-300',
    header: 'p-6 border-b-4 border-pink-200',
    title: 'text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent',
    description: 'text-gray-600 mt-2 font-medium',
    label: 'text-sm font-bold text-purple-700',
    input: 'w-full px-4 py-3 bg-pink-50 border-3 border-pink-300 rounded-2xl transition-all duration-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-pink-50 border-3 border-pink-300 rounded-2xl transition-all duration-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-pink-50 border-3 border-pink-300 rounded-2xl transition-all duration-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 focus:outline-none',
    radio: 'h-5 w-5 text-pink-600 focus:ring-pink-500 border-pink-300',
    checkbox: 'h-5 w-5 text-pink-600 focus:ring-pink-500 border-pink-300 rounded-lg',
    button: 'w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100'
  },

  'brutalist': {
    id: 'brutalist',
    name: 'Brutalist',
    container: 'min-h-screen py-8',
    card: 'bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
    header: 'p-6 border-b-4 border-black',
    title: 'text-3xl font-black text-black uppercase tracking-wider',
    description: 'text-black mt-2 font-bold uppercase text-sm',
    label: 'text-xs font-black text-black uppercase tracking-wider',
    input: 'w-full px-4 py-3 bg-white border-4 border-black transition-all duration-100 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none font-bold',
    textarea: 'w-full px-4 py-3 bg-white border-4 border-black transition-all duration-100 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none font-bold resize-none',
    select: 'w-full px-4 py-3 bg-white border-4 border-black transition-all duration-100 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none font-bold',
    radio: 'h-5 w-5 text-black focus:ring-black border-2 border-black',
    checkbox: 'h-5 w-5 text-black focus:ring-black border-2 border-black',
    button: 'w-full bg-black hover:bg-gray-800 text-white font-black py-4 px-6 uppercase tracking-wider transition-all duration-100 transform hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-white'
  },

  'pastel-dream': {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    container: 'min-h-screen py-8',
    card: 'bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border-2 border-pink-200',
    header: 'p-6 border-b-2 border-pink-200',
    title: 'text-2xl font-light bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent',
    description: 'text-purple-600 mt-2 font-light',
    label: 'text-sm font-medium text-purple-600',
    input: 'w-full px-4 py-3 bg-pink-50/50 border-2 border-pink-200 rounded-2xl backdrop-blur-sm transition-all duration-300 focus:border-purple-300 focus:ring-2 focus:ring-purple-300/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-pink-50/50 border-2 border-pink-200 rounded-2xl backdrop-blur-sm transition-all duration-300 focus:border-purple-300 focus:ring-2 focus:ring-purple-300/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-pink-50/50 border-2 border-pink-200 rounded-2xl backdrop-blur-sm transition-all duration-300 focus:border-purple-300 focus:ring-2 focus:ring-purple-300/20 focus:outline-none',
    radio: 'h-4 w-4 text-pink-400 focus:ring-pink-400 border-pink-300',
    checkbox: 'h-4 w-4 text-pink-400 focus:ring-pink-400 border-pink-300 rounded',
    button: 'w-full bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 hover:from-pink-400 hover:via-purple-400 hover:to-blue-400 text-white font-medium py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50'
  },

  'neo-modern': {
    id: 'neo-modern',
    name: 'Neo Modern',
    container: 'min-h-screen py-8',
    card: 'bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700',
    header: 'p-6 border-b border-gray-700',
    title: 'text-2xl font-bold text-white',
    description: 'text-gray-300 mt-2',
    label: 'text-sm font-medium text-gray-200',
    input: 'w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    textarea: 'w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none',
    select: 'w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
    radio: 'h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600',
    checkbox: 'h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 rounded',
    button: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gray-900'
  },

  'modern-bold': {
    id: 'modern-bold',
    name: 'Modern Bold',
    container: 'min-h-screen py-8',
    card: 'bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-blue-200',
    header: 'p-6 border-b-2 border-blue-200',
    title: 'text-3xl font-black text-gray-900',
    description: 'text-gray-700 mt-2 font-semibold',
    label: 'text-sm font-bold text-gray-800 uppercase tracking-wide',
    input: 'w-full px-4 py-4 bg-white border-2 border-blue-300 rounded-xl transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 focus:outline-none font-semibold',
    textarea: 'w-full px-4 py-4 bg-white border-2 border-blue-300 rounded-xl transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 focus:outline-none font-semibold resize-none',
    select: 'w-full px-4 py-4 bg-white border-2 border-blue-300 rounded-xl transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 focus:outline-none font-semibold',
    radio: 'h-5 w-5 text-blue-600 focus:ring-blue-600 border-2 border-blue-300',
    checkbox: 'h-5 w-5 text-blue-600 focus:ring-blue-600 border-2 border-blue-300 rounded',
    button: 'w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-xl uppercase tracking-wide transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    background: 'bg-gradient-to-br from-blue-50 to-indigo-100'
  }
};

export function getTheme(themeId: string): ThemeStyles {
  return themes[themeId] || themes['modern'];
}

export function parseTheme(themeData: any): ThemeStyles {
  console.log('🎨 [Theme] Parsing theme data:', themeData, typeof themeData);
  
  if (typeof themeData === 'string') {
    console.log('🎨 [Theme] Parsing string theme:', themeData);
    try {
      // Try to parse as JSON first
      const parsedTheme = JSON.parse(themeData);
      console.log('🎨 [Theme] Parsed JSON theme:', parsedTheme);
      if (parsedTheme.id) {
        console.log('🎨 [Theme] Using theme ID:', parsedTheme.id);
        const selectedTheme = getTheme(parsedTheme.id);
        console.log('🎨 [Theme] Selected theme:', selectedTheme.name);
        return selectedTheme;
      }
    } catch (e) {
      // If not JSON, treat as theme ID
      console.log('🎨 [Theme] Not JSON, treating as theme ID:', themeData);
      return getTheme(themeData);
    }
  }
  
  if (typeof themeData === 'object' && themeData !== null) {
    try {
      if (themeData.id) {
        console.log('🎨 [Theme] Using object theme ID:', themeData.id);
        const selectedTheme = getTheme(themeData.id);
        console.log('🎨 [Theme] Selected theme:', selectedTheme.name);
        return selectedTheme;
      }
      // If it's a custom theme object, return it with fallbacks
      return {
        ...themes['modern'],
        ...themeData
      };
    } catch (error) {
      console.warn('Error parsing theme data:', error);
      return themes['modern'];
    }
  }
  
  console.log('🎨 [Theme] Falling back to modern theme');
  return themes['modern'];
}
