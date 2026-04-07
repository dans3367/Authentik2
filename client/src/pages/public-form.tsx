import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRoute } from 'wouter';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBotDetection } from '@/hooks/useBotDetection';
import TurnstileWidget from '@/components/TurnstileWidget';

// ─── Theme System ────────────────────────────────────────────────────────────

interface ThemeStyles {
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

const themes: Record<string, ThemeStyles> = {
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
  },
  'monospace-terminal': {
    id: 'monospace-terminal',
    name: 'Monospace Terminal',
    container: 'min-h-screen py-8',
    card: 'bg-gray-950 border-2 border-green-900/60 rounded-lg shadow-2xl shadow-green-500/5 relative overflow-hidden after:content-[""] after:absolute after:inset-0 after:pointer-events-none after:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.03)_2px,rgba(0,255,65,0.03)_4px)]',
    header: 'p-6 border-b border-green-900/40',
    title: 'text-2xl font-bold text-green-400 font-mono',
    description: 'text-green-600 mt-2 font-mono text-sm',
    label: 'text-xs font-bold text-green-500 font-mono tracking-widest uppercase',
    input: 'w-full px-4 py-3 bg-gray-900 border border-green-800/50 rounded-sm transition-all duration-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none text-green-300 placeholder-green-900 font-mono caret-green-400',
    textarea: 'w-full px-4 py-3 bg-gray-900 border border-green-800/50 rounded-sm transition-all duration-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none text-green-300 placeholder-green-900 font-mono caret-green-400 resize-none',
    select: 'w-full px-4 py-3 bg-gray-900 border border-green-800/50 rounded-sm transition-all duration-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none text-green-300 font-mono',
    radio: 'h-4 w-4 text-green-500 focus:ring-green-500 border-green-800',
    checkbox: 'h-4 w-4 text-green-500 focus:ring-green-500 border-green-800 rounded-sm',
    button: 'w-full bg-green-600/20 border border-green-500 text-green-400 hover:bg-green-500/30 hover:text-green-300 font-mono font-bold py-3 px-6 rounded-sm tracking-widest uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    background: 'bg-black'
  },
  'silk': {
    id: 'silk',
    name: 'Silk',
    container: 'min-h-screen py-8',
    card: 'bg-white/80 backdrop-blur-md border border-stone-200/70 rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border-t-2 [border-image:linear-gradient(to_right,#fda4af,#fde68a,#fda4af)_1]',
    header: 'p-6 border-b border-stone-100',
    title: 'text-3xl font-light font-serif text-stone-800 tracking-wide',
    description: 'text-stone-500 mt-2 text-sm',
    label: 'text-[11px] font-medium text-stone-500 tracking-[0.15em] uppercase',
    input: 'w-full px-4 py-3 bg-stone-50/80 border border-stone-200/80 rounded-xl transition-all duration-300 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40 focus:outline-none text-stone-800 placeholder-stone-400',
    textarea: 'w-full px-4 py-3 bg-stone-50/80 border border-stone-200/80 rounded-xl transition-all duration-300 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40 focus:outline-none text-stone-800 placeholder-stone-400 resize-none',
    select: 'w-full px-4 py-3 bg-stone-50/80 border border-stone-200/80 rounded-xl transition-all duration-300 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40 focus:outline-none text-stone-800',
    radio: 'h-4 w-4 text-rose-400 focus:ring-rose-300 border-stone-300',
    checkbox: 'h-4 w-4 text-rose-400 focus:ring-rose-300 border-stone-300 rounded-lg',
    button: 'w-full bg-gradient-to-r from-stone-800 to-stone-900 text-white font-medium py-3.5 px-6 rounded-xl tracking-wider text-sm transition-all duration-300 shadow-lg shadow-stone-900/10 hover:shadow-xl hover:shadow-stone-900/20 hover:from-stone-700 hover:to-stone-800 disabled:opacity-50 disabled:cursor-not-allowed',
    background: 'bg-gradient-to-br from-stone-50 via-rose-50/30 to-stone-100'
  }
};

function getTheme(themeId: string): ThemeStyles {
  return themes[themeId] || themes['modern'];
}

function parseTheme(themeData: any): ThemeStyles {
  if (typeof themeData === 'string') {
    try {
      const parsedTheme = JSON.parse(themeData);
      if (parsedTheme.id) {
        return getTheme(parsedTheme.id);
      }
    } catch (e) {
      return getTheme(themeData);
    }
  }

  if (typeof themeData === 'object' && themeData !== null) {
    try {
      if (themeData.id) {
        return getTheme(themeData.id);
      }
      return { ...themes['modern'], ...themeData };
    } catch {
      return themes['modern'];
    }
  }

  return themes['modern'];
}

// ─── FullName Component ──────────────────────────────────────────────────────

interface FullNameProps {
  id: string;
  required?: boolean;
  firstNameValue?: string;
  lastNameValue?: string;
  onFirstNameChange?: (value: string) => void;
  onLastNameChange?: (value: string) => void;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  theme?: { label?: string; input?: string } | null;
}

function FullName({
  id,
  required = false,
  firstNameValue = '',
  lastNameValue = '',
  onFirstNameChange,
  onLastNameChange,
  firstNamePlaceholder = "First Name",
  lastNamePlaceholder = "Last Name",
  theme
}: FullNameProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <label htmlFor={`${id}-first`} className={theme?.label || 'text-sm font-medium text-gray-700'}>
          First Name {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={`${id}-first`}
          type="text"
          placeholder={firstNamePlaceholder}
          value={firstNameValue}
          onChange={(e) => onFirstNameChange?.(e.target.value)}
          required={required}
          className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={`${id}-last`} className={theme?.label || 'text-sm font-medium text-gray-700'}>
          Last Name {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={`${id}-last`}
          type="text"
          placeholder={lastNamePlaceholder}
          value={lastNameValue}
          onChange={(e) => onLastNameChange?.(e.target.value)}
          required={required}
          className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
        />
      </div>
    </div>
  );
}

// ─── Form Language Translations ──────────────────────────────────────────────

type FormLanguage = 'en' | 'es';
const formButtonTranslations: Record<FormLanguage, { submit: string; submitting: string; disclaimer: string }> = {
  en: {
    submit: 'Submit Form',
    submitting: 'Submitting...',
    disclaimer: 'By submitting this form, you agree to receive email and phone communications from us, including marketing messages, updates, and promotional offers. Standard message and data rates may apply to phone communications. You can opt out at any time by following the unsubscribe instructions in our emails or by contacting us directly.'
  },
  es: {
    submit: 'Enviar Formulario',
    submitting: 'Enviando...',
    disclaimer: 'Al enviar este formulario, aceptas recibir comunicaciones por correo electr\u00f3nico y tel\u00e9fono de nuestra parte, incluidos mensajes de marketing, actualizaciones y ofertas promocionales. Se pueden aplicar tarifas est\u00e1ndar de mensajes y datos a las comunicaciones telef\u00f3nicas. Puedes darte de baja en cualquier momento siguiendo las instrucciones de cancelaci\u00f3n de suscripci\u00f3n en nuestros correos electr\u00f3nicos o contact\u00e1ndonos directamente.'
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormElement {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  formData: {
    elements: FormElement[];
    settings?: {
      language?: FormLanguage;
      [key: string]: any;
    };
  };
  theme: string;
  logoUrl?: string | null;
  companyName?: string | null;
}

// ─── Public Form Page ────────────────────────────────────────────────────────

const PublicFormPage: React.FC = () => {
  const [, params] = useRoute('/form/:id');
  const formId = params?.id;
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [theme, setTheme] = useState<ThemeStyles | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [formLoadTime] = useState<number>(Date.now());
  const [honeypot, setHoneypot] = useState('');
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const botDetection = useBotDetection();
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [googleSignInSuccess, setGoogleSignInSuccess] = useState<{ email: string } | null>(null);
  const [googleSignInError, setGoogleSignInError] = useState<string | null>(null);
  const [googleInitialized, setGoogleInitialized] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Fetch Google Client ID
  useEffect(() => {
    fetch('/api/forms/public/google-client-id')
      .then(r => r.json())
      .then(data => { if (data.clientId) setGoogleClientId(data.clientId); })
      .catch(() => {});
  }, []);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    if (!formId) return;
    setGoogleSignInLoading(true);
    setGoogleSignInError(null);
    try {
      const res = await fetch('/api/forms/public/google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, formId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to verify Google sign-in');
      }
      const data = await res.json();
      setGoogleSignInSuccess({ email: data.email });
      setSubmitted(true);
    } catch (err: any) {
      setGoogleSignInError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleSignInLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (!googleClientId || googleInitialized || !form || form.category !== 'email-signup') return;

    if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [googleClientId, googleInitialized, form]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current || googleInitialized || !form || form.category !== 'email-signup') return;

    let retryCount = 0;
    const maxRetries = 25;
    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        retryCount++;
        if (retryCount >= maxRetries) return;
        setTimeout(initGoogle, 300);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleButtonRef.current) {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signup_with',
          shape: 'rectangular',
          width: 320,
        });
      }
      setGoogleInitialized(true);
    };
    initGoogle();
  }, [googleClientId, googleInitialized, form, handleGoogleCredential]);

  useEffect(() => {
    if (!formId) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }

    const fetchForm = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/forms/public/${formId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Form not found or inactive');
          } else {
            setError('Failed to load form');
          }
          return;
        }

        const data = await response.json();

        // Normalize: the main server public endpoint returns formData as parsed object
        const formData = typeof data.formData === 'string' ? JSON.parse(data.formData) : data.formData;
        const normalized: FormData = { ...data, formData };

        setForm(normalized);

        // Store logo URL and company name from API response
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
        }
        if (data.companyName) {
          setCompanyName(data.companyName);
        }
        if (data.turnstileSiteKey) {
          setTurnstileSiteKey(data.turnstileSiteKey);
        }

        const parsedTheme = parseTheme(data.theme);
        setTheme(parsedTheme);

        // Initialize form values
        const initialValues: Record<string, any> = {};
        formData.elements?.forEach((element: FormElement) => {
          initialValues[element.id] = '';
        });
        setFormValues(initialValues);
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const handleInputChange = (elementId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Client-side bot detection: if suspicious and Turnstile is available, require challenge
    if (turnstileSiteKey && botDetection.isSuspicious && !turnstileToken) {
      setShowTurnstile(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/forms/public/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: formValues,
          _hp_email: honeypot,
          _ft: formLoadTime,
          ...(turnstileToken ? { _turnstile_token: turnstileToken } : {}),
        })
      });

      // Server requested CAPTCHA challenge
      if (response.status === 449 && turnstileSiteKey) {
        setShowTurnstile(true);
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFormElement = (element: FormElement) => {
    const { id, type, label, required, placeholder, options } = element;

    switch (type) {
      case 'text':
      case 'text-input':
      case 'email':
      case 'email-input':
      case 'tel':
      case 'url':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              id={id}
              type={type === 'text-input' ? 'text' : type === 'email-input' ? 'email' : type}
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            />
          </div>
        );

      case 'full-name':
        return (
          <div key={id} className="space-y-2">
            <FullName
              id={id}
              required={required}
              firstNameValue={formValues[`${id}_first`] || ''}
              lastNameValue={formValues[`${id}_last`] || ''}
              onFirstNameChange={(value) => handleInputChange(`${id}_first`, value)}
              onLastNameChange={(value) => handleInputChange(`${id}_last`, value)}
              firstNamePlaceholder="First Name"
              lastNamePlaceholder="Last Name"
              theme={theme}
            />
          </div>
        );

      case 'first-name':
      case 'last-name':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              id={id}
              type="text"
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.input || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id={id}
              placeholder={placeholder}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.textarea || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'}
              rows={4}
            />
          </div>
        );

      case 'select':
        return (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <select
              id={id}
              required={required}
              value={formValues[id] || ''}
              onChange={(e) => handleInputChange(id, e.target.value)}
              className={theme?.select || 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'}
            >
              <option value="">Select an option...</option>
              {options?.map((option, index) => (
                <option key={index} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );

      case 'radio':
        return (
          <div key={id} className="space-y-2">
            <label className={theme?.label || 'text-sm font-medium text-gray-700'}>
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${id}-${index}`}
                    name={id}
                    value={option}
                    required={required}
                    checked={formValues[id] === option}
                    onChange={(e) => handleInputChange(id, e.target.value)}
                    className={theme?.radio || 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300'}
                  />
                  <label htmlFor={`${id}-${index}`} className={theme?.label || 'text-sm font-normal text-gray-700'}>
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={id}
                required={required}
                checked={formValues[id] || false}
                onChange={(e) => handleInputChange(id, e.target.checked)}
                className={theme?.checkbox || 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'}
              />
              <label htmlFor={id} className={theme?.label || 'text-sm font-normal text-gray-700'}>
                {label} {required && <span className="text-red-500">*</span>}
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className={`w-full max-w-md ${theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}`}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h3 className={`flex items-center space-x-2 ${theme?.title || 'text-xl font-semibold text-gray-900'}`}>
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Error</span>
            </h3>
          </div>
          <div className="p-6">
            <p className={theme?.description || 'text-gray-600'}>{error || 'Form not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme?.background || 'bg-gray-50'}`}>
        <div className={`w-full max-w-md ${theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}`}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h3 className={`flex items-center space-x-2 ${theme?.title || 'text-xl font-semibold text-gray-900'}`}>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Success!</span>
            </h3>
          </div>
          <div className="p-6">
            <p className={theme?.description || 'text-gray-600'}>
              Thank you for your submission. Your response has been recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme?.container || 'min-h-screen py-8'} ${theme?.background || 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 max-w-2xl">
        {logoUrl ? (
          <div className="flex justify-center mb-6">
            <img
              src={logoUrl}
              alt={companyName || 'Company Logo'}
              className="max-h-32 max-w-[400px] object-contain"
            />
          </div>
        ) : companyName ? (
          <div className="text-center mb-6">
            <span className="text-lg font-semibold text-gray-700">{companyName}</span>
          </div>
        ) : null}
        <div className={theme?.card || 'bg-white rounded-lg shadow-md border border-gray-300'}>
          <div className={theme?.header || 'p-6 border-b border-gray-200'}>
            <h1 className={theme?.title || 'text-2xl font-bold text-gray-900'}>{form.title}</h1>
            {form.description && (
              <p className={theme?.description || 'text-gray-600 mt-2'}>{form.description}</p>
            )}
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field - hidden from real users, bots will fill it */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
                <label htmlFor="_hp_email">Email</label>
                <input
                  type="email"
                  id="_hp_email"
                  name="_hp_email"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {form.formData.elements?.map(renderFormElement)}

              {form.category === 'email-signup' && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {(() => {
                      const lang = (form?.formData?.settings?.language || 'en') as FormLanguage;
                      const t = formButtonTranslations[lang] || formButtonTranslations.en;
                      return t.disclaimer;
                    })()}
                  </p>
                </div>
              )}

              {showTurnstile && turnstileSiteKey && (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onVerify={(token) => setTurnstileToken(token)}
                />
              )}

              <button
                type="submit"
                disabled={submitting || (showTurnstile && !turnstileToken)}
                className={theme?.button || 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'}
              >
                {(() => {
                  const lang = (form?.formData?.settings?.language || 'en') as FormLanguage;
                  const t = formButtonTranslations[lang] || formButtonTranslations.en;
                  return submitting ? t.submitting : t.submit;
                })()}
              </button>
            </form>

            {form.category === 'email-signup' && googleClientId && (
              <div className="mt-4">
                {googleSignInSuccess ? (
                  <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700">
                      Successfully signed up with {googleSignInSuccess.email}!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white text-gray-500">
                          {((form?.formData?.settings?.language || 'en') === 'es')
                            ? 'o regístrate con Google'
                            : 'or sign up with Google'}
                        </span>
                      </div>
                    </div>

                    {/* Google Sign-In Button */}
                    <div className="flex flex-col items-center">
                      {googleSignInLoading ? (
                        <div className="flex items-center space-x-2 py-3 px-6 border border-gray-300 rounded-md bg-gray-50">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-gray-600">Processing...</span>
                        </div>
                      ) : (
                        <div
                          ref={googleButtonRef}
                          className={submitting ? 'opacity-50 pointer-events-none' : ''}
                        />
                      )}
                    </div>

                    {googleSignInError && (
                      <div className="mt-2 flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-600">{googleSignInError}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PublicFormPage;
