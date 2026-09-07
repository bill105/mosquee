'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

/* ================= TYPES ================= */

type CategorySlug = 'cours-audio' | 'conferences' | 'preches' | 'podcasts' | 'videos' | 'articles';
type ViewName = 'home' | 'recherche' | 'categorie' | 'evenements' | 'media';
type MediaSlug = 'chaine' | CategorySlug;
type MediaVideo = { id: string; title: string; thumbnail: string; published: string; author: string; views: number | null };
type MediaPayload = { ok: true; label: string; playlistId: string | null; playlistUrl: string; channelUrl: string; videos: MediaVideo[] };
type Purpose = 'don_libre' | 'sadaqa' | 'zakat' | 'construction';
type SortBy = 'recent' | 'popular' | 'az';
type FilterSlug = 'tout' | CategorySlug;

type Category = { label: string; icon: string; img: string };

type ContentItem = {
  id: number;
  t: string;
  c: CategorySlug;
  dur: string;
  date: string;
  views: number;
  rec: boolean;
  img: string;
  d: string;
};

type EventItem = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM ou ""
  place: string;
  imageUrl: string;
};

/* Audio hébergé par la mosquée (recommandation de l'Imam) — section « Les nouveautés » */
type AudioItem = {
  id: number;
  title: string;
  audioUrl: string;
  createdAt: string; // ISO
};

type PrayerTimesResult = {
  fajr: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
};

interface CalculationParams {
  madhab?: unknown;
}

/* Interface minimale pour la bibliothèque Adhan chargée depuis le CDN */
interface AdhanNamespace {
  Coordinates: new (latitude: number, longitude: number) => unknown;
  CalculationMethod: { MuslimWorldLeague: () => CalculationParams };
  Madhab: { readonly Shafi: unknown };
  PrayerTimes: new (coordinates: unknown, date: Date, params: CalculationParams) => PrayerTimesResult;
}

/* Lecteur YouTube piloté en JS (mode audio « MP3 ») via l'API IFrame officielle */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  cueVideoById(id: string): void;
  loadVideoById(id: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    }
  ) => YTPlayer;
};

declare global {
  interface Window {
    adhan?: AdhanNamespace;
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/* ================= DATA ================= */

const LOGO_URL = 'https://i.ibb.co/bj08x4h6/Whats-App-Image-2026-08-11-at-16-23-01.jpg';

const CATS: Record<CategorySlug, Category> = {
  'cours-audio': { label: 'Cours audio', icon: '🎧', img: 'https://images.pexels.com/photos/36188808/pexels-photo-36188808.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
  'conferences': { label: 'Conférences', icon: '🎤', img: 'https://images.pexels.com/photos/5226142/pexels-photo-5226142.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
  'preches': { label: 'Prêches', icon: '🕌', img: 'https://images.pexels.com/photos/36211987/pexels-photo-36211987.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
  'podcasts': { label: 'Podcasts', icon: '🎙️', img: 'https://images.pexels.com/photos/13549654/pexels-photo-13549654.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
  'videos': { label: 'Vidéos', icon: '▶️', img: 'https://images.pexels.com/photos/36290981/pexels-photo-36290981.png?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
  'articles': { label: 'Articles', icon: '📄', img: 'https://images.pexels.com/photos/31679271/pexels-photo-31679271.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600' },
};

/* Ordre du menu déroulant "Parcourir" (identique à l'original) */
const NAV_CATS: CategorySlug[] = ['cours-audio', 'conferences', 'preches', 'articles', 'videos', 'podcasts'];
/* Ordre du footer (identique à l'original) */
const FOOTER_CATS: CategorySlug[] = ['cours-audio', 'conferences', 'preches', 'podcasts', 'videos', 'articles'];
/* Ordre de la grille bibliothèque / chips (ordre de déclaration de CATS) */
const ALL_CATS: CategorySlug[] = ['cours-audio', 'conferences', 'preches', 'podcasts', 'videos', 'articles'];

/* Catégories diffusées en audio « MP3 » : badge MP3 sur les cartes + section
   « Les nouveautés » ; les pochettes audio décoratives restent le repli sans photo. */
const AUDIO_CATS: ReadonlySet<CategorySlug> = new Set(['cours-audio', 'conferences', 'preches', 'podcasts']);

function isAudioCat(c: CategorySlug): boolean {
  return AUDIO_CATS.has(c);
}

/* --- YouTube : chaîne officielle de la mosquée + playlists par catégorie --- */
const CHANNEL_URL = 'https://www.youtube.com/channel/UCVVjtGQU25_xOboeBIkWL6Q';
const PLAYLIST_BY_CAT: Record<CategorySlug, string> = {
  'preches': 'PLeGdcDsHRs08',
  'cours-audio': 'PLJLCSUIcelFE',
  'conferences': 'PLN37fyXR7wBQ',
  'articles': 'PLDCy4vU3MR8A',
  'videos': 'PLQxlDg4K_iRE',
  'podcasts': 'PLHr6mFtpd7nw',
};

/* Onglets de la page Médias (chaîne + 6 playlists) */
const MEDIA_TABS: Array<{ slug: MediaSlug; label: string; icon: string }> = [
  { slug: 'chaine', label: 'Nouveautés', icon: '🆕' },
  { slug: 'preches', label: 'Prêches', icon: '🕌' },
  { slug: 'cours-audio', label: 'Cours audio', icon: '🎧' },
  { slug: 'conferences', label: 'Conférences', icon: '🎤' },
  { slug: 'podcasts', label: 'Podcasts', icon: '🎙️' },
  { slug: 'videos', label: 'Vidéos', icon: '▶️' },
  { slug: 'articles', label: 'Articles', icon: '📄' },
];

/* Mode de lecture par défaut de chaque onglet Médias : tout démarre en audio
   « MP3 » (comme demandé par l'admin), sauf l'onglet Vidéos qui reste en vidéo. */
function defaultAudioMode(cat: MediaSlug): boolean {
  return cat !== 'videos';
}

const YOUTUBE_ICON = (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);

const CONTENT: ContentItem[] = [
  { id: 1, t: "Les fondements de la foi (Aqîda)", c: 'cours-audio', dur: "48 min", date: "2026-02-18", views: 12400, rec: true, img: "https://images.pexels.com/photos/13549654/pexels-photo-13549654.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Un cours essentiel pour comprendre les piliers de la foi et raffermir sa croyance en Allah, Ses anges, Ses livres et Ses prophètes." },
  { id: 2, t: "La patience face aux épreuves", c: 'conferences', dur: "1h12", date: "2026-02-15", views: 9800, rec: true, img: "https://images.pexels.com/photos/5226142/pexels-photo-5226142.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Comment le croyant accueille les difficultés avec patience et confiance en Allah, à la lumière du Coran et de la Sunna." },
  { id: 3, t: "Khutba : la gratitude envers Allah", c: 'preches', dur: "32 min", date: "2026-02-21", views: 21200, rec: true, img: "https://images.pexels.com/photos/36211987/pexels-photo-36211987.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le prêche du vendredi sur l'importance de la gratitude (choukr) et ses bienfaits dans la vie du musulman." },
  { id: 4, t: "Questions / Réponses avec l'Imam", c: 'podcasts', dur: "56 min", date: "2026-02-20", views: 7300, rec: false, img: "https://images.pexels.com/photos/36188888/pexels-photo-36188888.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Épisode podcast où l'Imam Dr Bako répond aux questions de la communauté sur la purification, la prière et le quotidien." },
  { id: 5, t: "Comment se préparer au Ramadan", c: 'articles', dur: "8 min", date: "2026-02-22", views: 15600, rec: true, img: "https://images.pexels.com/photos/20784677/pexels-photo-20784677.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Un guide pratique pour accueillir le mois béni du Ramadan : intention, jeûne, prières nocturnes et charité." },
  { id: 6, t: "Récitation du Coran — Sourate Al-Kahf", c: 'videos', dur: "24 min", date: "2026-02-19", views: 33100, rec: true, img: "https://images.pexels.com/photos/36290981/pexels-photo-36290981.png?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Une belle récitation de la Sourate Al-Kahf par l'Imam Dr Bako Aboubacar, idéale pour le vendredi." },
  { id: 7, t: "Apprendre le Tajwid — les règles de base", c: 'cours-audio', dur: "40 min", date: "2026-02-12", views: 8900, rec: false, img: "https://images.pexels.com/photos/13549657/pexels-photo-13549657.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Première leçon de Tajwid : les points de articulation des lettres et la règle du Noon Saakin." },
  { id: 8, t: "La famille en Islam", c: 'conferences', dur: "1h05", date: "2026-02-09", views: 11200, rec: false, img: "https://images.pexels.com/photos/30956654/pexels-photo-30956654.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Construire un foyer sur les valeurs islamiques : respect, compassion, droits et devoirs de chacun." },
  { id: 9, t: "Sermon de l'Aïd al-Fitr", c: 'preches', dur: "28 min", date: "2026-02-05", views: 18700, rec: false, img: "https://images.pexels.com/photos/30947036/pexels-photo-30947036.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le sermon de la fête de la fin du jeûne : reconnaissance envers Allah, joie et solidarité." },
  { id: 10, t: "Les invocations du matin et du soir", c: 'articles', dur: "6 min", date: "2026-02-23", views: 14400, rec: false, img: "https://images.pexels.com/photos/36188808/pexels-photo-36188808.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Retrouvez les principales invocations (adhkâr) à réciter matin et soir pour protéger votre journée." },
  { id: 11, t: "Comprendre la Zakat", c: 'videos', dur: "18 min", date: "2026-02-11", views: 9600, rec: false, img: "https://images.pexels.com/photos/31679271/pexels-photo-31679271.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Tout savoir sur la Zakat : qui doit la payer, comment la calculer et à qui la donner." },
  { id: 12, t: "Histoires des Compagnons", c: 'podcasts', dur: "1h", date: "2026-02-08", views: 6700, rec: false, img: "https://images.pexels.com/photos/30890556/pexels-photo-30890556.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Une série podcast retraçant la vie édifiante des meilleurs compagnons du Prophète ﷺ." },
  { id: 13, t: "La biographie du Prophète ﷺ (Sîra)", c: 'cours-audio', dur: "55 min", date: "2026-02-01", views: 16800, rec: true, img: "https://images.pexels.com/photos/36211986/pexels-photo-36211986.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Découvrez la noble vie du Messager d'Allah ﷺ, sa naissance, sa mission et son excellent caractère." },
  { id: 14, t: "L'éthique du musulman (Akhlaq)", c: 'conferences', dur: "58 min", date: "2026-01-28", views: 7900, rec: false, img: "https://images.pexels.com/photos/5226142/pexels-photo-5226142.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le bon comportement du musulman envers ses parents, ses voisins et la société entière." },
  { id: 15, t: "L'importance de la prière en groupe", c: 'preches', dur: "30 min", date: "2026-01-25", views: 13500, rec: false, img: "https://images.pexels.com/photos/30956657/pexels-photo-30956657.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Les mérites de la prière en congrégation à la mosquée et son rôle dans la fraternité." },
  { id: 16, t: "Les mérites du Dhikr", c: 'articles', dur: "7 min", date: "2026-01-22", views: 10200, rec: false, img: "https://images.pexels.com/photos/13549654/pexels-photo-13549654.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Pourquoi et comment évoquer Allah (Dhikr) tout au long de la journée pour apaiser le cœur." },
  { id: 17, t: "Apprendre la prière pas à pas", c: 'videos', dur: "22 min", date: "2026-01-20", views: 28400, rec: true, img: "https://images.pexels.com/photos/31191930/pexels-photo-31191930.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Un tutoriel détaillé pour accomplir la prière (Salat) correctement, des mouvements aux invocations." },
  { id: 18, t: "Les règles de la purification (Tahara)", c: 'cours-audio', dur: "44 min", date: "2026-01-18", views: 8100, rec: false, img: "https://images.pexels.com/photos/20784677/pexels-photo-20784677.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le Wudu (ablutions), le Ghusl et le Tayammum expliqués simplement pour purifier son culte." },
  { id: 19, t: "Le jeûne surérogatoire et ses bienfaits", c: 'conferences', dur: "50 min", date: "2026-01-15", views: 5600, rec: false, img: "https://images.pexels.com/photos/30947036/pexels-photo-30947036.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le lundi, le jeudi, le jour de Arafat… Découvrez les jeûnes recommandés et leurs récompenses." },
  { id: 20, t: "Rappel du matin : la gravité du péché", c: 'preches', dur: "26 min", date: "2026-01-12", views: 9100, rec: false, img: "https://images.pexels.com/photos/36211987/pexels-photo-36211987.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Un prêche édifiant sur la crainte d'Allah et l'importance du repentir sincère." },
  { id: 21, t: "Le Tawhid : l'unicité d'Allah", c: 'podcasts', dur: "1h02", date: "2026-01-10", views: 7200, rec: true, img: "https://images.pexels.com/photos/36188888/pexels-photo-36188888.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Le fondement de l'Islam : reconnaître et adorer Allah seul, sans aucun associé." },
  { id: 22, t: "10 hadiths pour le quotidien", c: 'articles', dur: "9 min", date: "2026-01-08", views: 19800, rec: false, img: "https://images.pexels.com/photos/31679271/pexels-photo-31679271.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Une sélection de dix hadiths du Prophète ﷺ à appliquer chaque jour pour améliorer sa vie." },
  { id: 23, t: "Visite guidée de la mosquée", c: 'videos', dur: "15 min", date: "2026-01-05", views: 12300, rec: false, img: "https://images.pexels.com/photos/36290984/pexels-photo-36290984.png?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Découvrez l'architecture et les espaces de la Mosquée Hadja Yah Diakite en vidéo." },
  { id: 24, t: "Les piliers de l'Islam", c: 'cours-audio', dur: "42 min", date: "2026-01-03", views: 22600, rec: false, img: "https://images.pexels.com/photos/13549657/pexels-photo-13549657.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600", d: "Les cinq piliers sur lesquels repose la religion : Chahada, Salat, Zakat, Sawm et Hajj." },
];

/* Les événements ne sont plus codés en dur : ils sont chargés depuis la base de
   données via /api/events et se gèrent depuis le panneau « ⚙ Gérer les événements ». */

const STATS: Array<{ target: number; label: string }> = [
  { target: 1240, label: 'Prêches & conférences' },
  { target: 3200, label: 'Cours & podcasts' },
  { target: 850, label: 'Articles' },
  { target: 15000, label: 'Membres de la communauté' },
];

const PRESETS: number[] = [1000, 2000, 5000, 10000, 25000, 50000];

const PURPOSES: Array<{ value: Purpose; label: string }> = [
  { value: 'don_libre', label: 'Don libre' },
  { value: 'sadaqa', label: 'Sadaqa' },
  { value: 'zakat', label: 'Zakat' },
  { value: 'construction', label: 'Construction de la mosquée' },
];

const PAY_METHODS: string[] = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov', 'Carte'];

/* Images recommandées par le site pour illustrer un événement (banque libre Pexels).
   L'administrateur peut en choisir une d'un clic, ou héberger la sienne. */
const RECOMMENDED_IMAGES: string[] = [
  'https://images.pexels.com/photos/29903474/pexels-photo-29903474.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
  'https://images.pexels.com/photos/36211987/pexels-photo-36211987.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
  'https://images.pexels.com/photos/36188808/pexels-photo-36188808.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
  'https://images.pexels.com/photos/31679271/pexels-photo-31679271.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
  'https://images.pexels.com/photos/20784677/pexels-photo-20784677.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
  'https://images.pexels.com/photos/30890556/pexels-photo-30890556.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600',
];

/* --- Réseaux sociaux officiels de la mosquée --- */
const YT_PATH = 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z';
const FB_PATH = 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z';
const IG_PATH = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z';
const TT_PATH = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';

function BrandIcon({ path, className }: { path: string; className: string }) {
  return <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

const FACEBOOK_URL = 'https://www.facebook.com/aboubacar.cheick.278560';
const INSTAGRAM_URL = 'https://www.instagram.com/mosqueyhadiakite/';
const TIKTOK_URL = 'https://www.tiktok.com/@mosquehadjayahdiakite';

const SOCIALS: Array<{ name: string; sub: string; url: string; bg: string; icon: ReactNode }> = [
  { name: 'YouTube', sub: 'Chaîne officielle', url: CHANNEL_URL, bg: 'bg-[#c4302b] hover:brightness-110', icon: <BrandIcon path={YT_PATH} className="w-9 h-9" /> },
  { name: 'Facebook', sub: 'Page officielle', url: FACEBOOK_URL, bg: 'bg-[#1877f2] hover:brightness-110', icon: <BrandIcon path={FB_PATH} className="w-9 h-9" /> },
  { name: 'Instagram', sub: '@mosqueyhadiakite', url: INSTAGRAM_URL, bg: 'bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:brightness-110', icon: <BrandIcon path={IG_PATH} className="w-9 h-9" /> },
  { name: 'TikTok', sub: '@mosquehadjayahdiakite', url: TIKTOK_URL, bg: 'bg-black ring-1 ring-white/25 hover:bg-[#1a1a1a]', icon: <BrandIcon path={TT_PATH} className="w-8 h-8" /> },
];

const DON_MIN = 500;
const DON_MAX = 2_000_000;

/* ================= HELPERS ================= */

const MONTHS_FR: string[] = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* Mois courts en majuscules pour le badge de date des événements (FÉV, MAR…) */
const MONTHS_BADGE: string[] = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

/* Jour et mois (UTC déterministe) affichés sur le badge d'un événement */
function eventDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? '—' : String(d.getUTCDate()).padStart(2, '0');
}

function eventMon(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? '' : MONTHS_BADGE[d.getUTCMonth()] ?? '';
}

/* Un événement est passé si sa date est antérieure à aujourd'hui (ISO UTC) */
function isPastEvent(date: string): boolean {
  return date < new Date().toISOString().slice(0, 10);
}

/* Formatage déterministe (UTC) pour éviter tout écart d'hydratation SSR/client */
function fmtDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getUTCDate()} ${MONTHS_FR[dt.getUTCMonth()] ?? ''} ${dt.getUTCFullYear()}`;
}

function fmtViews(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
}

function fmtTime(t: Date): string {
  return t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getRedirectUrl(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'success' in data && 'redirectUrl' in data) {
    const obj = data as { success: unknown; redirectUrl: unknown };
    if (obj.success === true && typeof obj.redirectUrl === 'string' && obj.redirectUrl.length > 0) {
      return obj.redirectUrl;
    }
  }
  return null;
}

function getDonateError(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return err;
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}

/* Reconstitution sûre de la réponse /api/media (typage strict) */
function asMediaPayload(data: unknown): MediaPayload | null {
  if (typeof data !== 'object' || data === null || !('ok' in data) || !('videos' in data)) return null;
  const obj = data as { ok: unknown; videos: unknown; label: unknown; playlistId: unknown; playlistUrl: unknown; channelUrl: unknown };
  if (obj.ok !== true || !Array.isArray(obj.videos)) return null;
  const videos: MediaVideo[] = [];
  for (const v of obj.videos) {
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.thumbnail !== 'string') return null;
    videos.push({
      id: o.id,
      title: o.title,
      thumbnail: o.thumbnail,
      published: typeof o.published === 'string' ? o.published : '',
      author: typeof o.author === 'string' ? o.author : '',
      views: typeof o.views === 'number' ? o.views : null,
    });
  }
  return {
    ok: true,
    label: typeof obj.label === 'string' ? obj.label : '',
    playlistId: typeof obj.playlistId === 'string' ? obj.playlistId : null,
    playlistUrl: typeof obj.playlistUrl === 'string' ? obj.playlistUrl : CHANNEL_URL,
    channelUrl: typeof obj.channelUrl === 'string' ? obj.channelUrl : CHANNEL_URL,
    videos,
  };
}

/* Reconstitution sûre de la réponse /api/events (typage strict) */
function asEventList(data: unknown): EventItem[] {
  if (typeof data !== 'object' || data === null || !('events' in data)) return [];
  const raw = (data as { events: unknown }).events;
  if (!Array.isArray(raw)) return [];
  const out: EventItem[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== 'number' || typeof o.title !== 'string' || typeof o.date !== 'string') continue;
    out.push({
      id: o.id,
      title: o.title,
      date: o.date,
      time: typeof o.time === 'string' ? o.time : '',
      place: typeof o.place === 'string' ? o.place : '',
      imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : '',
    });
  }
  return out;
}

/* Reconstitution sûre de la réponse /api/audios (typage strict) */
function asAudioList(data: unknown): AudioItem[] {
  if (typeof data !== 'object' || data === null || !('audios' in data)) return [];
  const raw = (data as { audios: unknown }).audios;
  if (!Array.isArray(raw)) return [];
  const out: AudioItem[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== 'number' || typeof o.title !== 'string' || typeof o.audioUrl !== 'string') continue;
    out.push({
      id: o.id,
      title: o.title,
      audioUrl: o.audioUrl,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
    });
  }
  return out;
}

/* Date ISO du flux YouTube → format français (déterministe UTC, sans mismatch SSR) */
function fmtMediaDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return fmtDate(d.toISOString().slice(0, 10));
}

/* Secondes → m:ss (ou h:mm:ss au-delà d'une heure) pour le lecteur audio */
function fmtSecs(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0:00';
  const s = Math.floor(total % 60);
  const m = Math.floor((total / 60) % 60);
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/* Charge (une seule fois) l'API IFrame officielle de YouTube pour piloter l'audio */
let ytApiPromise: Promise<YTNamespace> | null = null;
function loadYtApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('API YouTube indisponible'));
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Chargement de l’API YouTube impossible'));
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (!(window.YT && window.YT.Player)) reject(new Error('API YouTube trop longue à charger'));
    }, 12000);
  });
  return ytApiPromise;
}

/* ================= SOUS-COMPOSANTS ================= */

/* Bandeau décoratif d'un contenu audio sans photo (pochette « MP3 ») —
   utilisé comme repli quand aucune image n'est disponible. */
function AudioCover({ icon, label, dur, big, noBadge }: { icon: string; label: string; dur?: string; big?: boolean; noBadge?: boolean }) {
  return (
    <div className={`relative pattern-geo overflow-hidden ${big ? 'h-60' : 'h-44'}`}>
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" aria-hidden="true"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-gold/15" aria-hidden="true"></div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        <span className={`${big ? 'text-7xl' : 'text-6xl'} drop-shadow-lg transition duration-500 group-hover:scale-110`} aria-hidden="true">{icon}</span>
        <span className="flex items-end gap-1 h-5" aria-hidden="true">
          {[9, 14, 20, 13, 17, 10, 15, 8].map((h, i) => (
            <span key={i} className="w-1 rounded-full bg-gold/80" style={{ height: `${h}px` }}></span>
          ))}
        </span>
      </div>
      <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 text-green-deep flex items-center gap-1">{icon} {label}</span>
      {!noBadge && <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-gold text-[var(--green-deep)] text-[10px] font-extrabold tracking-wider">MP3</span>}
      {dur && <span className="absolute bottom-3 left-3 text-xs text-white font-semibold bg-black/45 px-2 py-0.5 rounded">{dur}</span>}
    </div>
  );
}

function ContentCard({ item, onOpen }: { item: ContentItem; onOpen: (item: ContentItem) => void }) {
  const cat = CATS[item.c];
  const audio = isAudioCat(item.c);
  return (
    <div className="card-hover group bg-white rounded-2xl overflow-hidden ring-1 ring-[var(--sand)] cursor-pointer flex flex-col" onClick={() => onOpen(item)}>
      {item.img ? (
        <div className="relative h-44 overflow-hidden">
          <img src={item.img} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={item.t} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 text-green-deep flex items-center gap-1">{cat.icon} {cat.label}</span>
          {audio && <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-gold text-[var(--green-deep)] text-[10px] font-extrabold tracking-wider">MP3</span>}
          <div className="play-btn absolute bottom-3 right-3 w-11 h-11 grid place-items-center rounded-full bg-white/90 text-green-deep shadow-lg">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <span className="absolute bottom-3 left-3 text-xs text-white font-semibold bg-black/45 px-2 py-0.5 rounded">{item.dur}</span>
        </div>
      ) : (
        /* Sans photo : pochette audio décorative (badge MP3 inclus) */
        <div className="relative">
          <AudioCover icon={cat.icon} label={cat.label} dur={item.dur} />
          <div className="play-btn absolute bottom-3 right-3 w-11 h-11 grid place-items-center rounded-full bg-white/90 text-green-deep shadow-lg">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-green-deep leading-snug line-clamp-2">{item.t}</h3>
        <p className="text-sm text-[var(--ink)]/55 mt-1.5 line-clamp-2 flex-1">{item.d}</p>
        <div className="flex items-center justify-between mt-3 text-xs text-[var(--ink)]/50">
          <span>👤 Dr Bako Aboubacar</span>
          <span>{fmtDate(item.date)}</span>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ slug, cat, onOpen }: { slug: CategorySlug; cat: Category; onOpen: (slug: CategorySlug) => void }) {
  return (
    <div onClick={() => onOpen(slug)} className="card-hover group relative h-52 rounded-2xl overflow-hidden cursor-pointer ring-1 ring-white/15">
      {cat.img ? (
        <img src={cat.img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={cat.label} />
      ) : (
        /* Repli sans photo : pochette décorative */
        <div className="absolute inset-0 pattern-geo flex flex-col items-center justify-center gap-3" aria-hidden="true">
          <span className="text-6xl drop-shadow-lg transition duration-500 group-hover:scale-110">{cat.icon}</span>
          <span className="flex items-end gap-1 h-6">
            {[10, 16, 24, 14, 20, 11, 18, 9].map((h, i) => (
              <span key={i} className="w-1.5 rounded-full bg-gold/80" style={{ height: `${h}px` }}></span>
            ))}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--green-deep)] via-[var(--green-deep)]/60 to-transparent"></div>
      <div className="absolute bottom-0 p-5">
        <span className="text-3xl">{cat.icon}</span>
        <h3 className="text-2xl font-extrabold mt-1">{cat.label}</h3>
        <p className="text-white/70 text-sm mt-1 flex items-center gap-1 group-hover:text-gold transition">
          Découvrir
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <div className="card-hover bg-white rounded-2xl overflow-hidden ring-1 ring-[var(--sand)] flex flex-col">
      {/* Image hébergée par l'administration (optionnelle) */}
      {event.imageUrl && (
        <div className="relative h-40 overflow-hidden shrink-0">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute top-3 left-3 w-14 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/30">
            <div className="pattern-geo text-white text-center py-1.5">
              <span className="block text-xl font-extrabold text-gold leading-none">{eventDay(event.date)}</span>
              <span className="block text-[10px] tracking-wider mt-0.5">{eventMon(event.date)}</span>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1">
        {!event.imageUrl && (
          <div className="w-24 shrink-0 pattern-geo text-white flex flex-col items-center justify-center py-4">
            <span className="text-3xl font-extrabold text-gold">{eventDay(event.date)}</span>
            <span className="text-xs tracking-wider">{eventMon(event.date)}</span>
          </div>
        )}
        <div className="p-4 flex-1">
          <h3 className="font-bold text-green-deep leading-snug">{event.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-[var(--ink)]/60">
            {event.time && <p className="flex items-center gap-1.5">🕒 {event.time}</p>}
            {event.place && <p className="flex items-center gap-1.5">📍 {event.place}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Carte d'un audio hébergé par la mosquée (« Recommandé par l'Imam ») :
   pochette décorative + lecteur d'écoute intégré, affichée dans « Les nouveautés ». */
function HostedAudioCard({ audio }: { audio: AudioItem }) {
  return (
    <div className="card-hover group bg-white rounded-2xl overflow-hidden ring-1 ring-[var(--sand)] flex flex-col">
      <AudioCover icon="🎙️" label="Recommandé par l'Imam" noBadge />
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-green-deep leading-snug line-clamp-2">{audio.title}</h3>
        <p className="text-xs text-[var(--ink)]/50 mt-1">🎙 Publié par la mosquée{audio.createdAt ? ` · ${fmtDate(audio.createdAt.slice(0, 10))}` : ''}</p>
        <audio controls preload="none" src={audio.audioUrl} className="w-full mt-3" aria-label={`Écouter : ${audio.title}`}></audio>
      </div>
    </div>
  );
}

/* Lecteur audio (mode « MP3 ») : la piste YouTube est réduite à une pochette et
   pilotée par l'API IFrame (lecture, pause, progression, volume, piste suivante). */
function AudioMp3Player({ video, playTick, onEnded, onFallbackToVideo }: { video: MediaVideo; playTick: number; onEnded: () => void; onFallbackToVideo: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loadedRef = useRef('');
  const lastTickRef = useRef(playTick);
  const endedRef = useRef(onEnded);
  const videoRef = useRef(video);
  const attemptsRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);

  useEffect(() => { endedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { videoRef.current = video; }, [video]);

  /* Création unique du lecteur — dans un nœud impératif car YouTube remplace
     ce nœud par une iframe (évite tout conflit avec le DOM géré par React). */
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement('div');
    host.appendChild(mount);
    loadYtApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          videoId: video.id,
          playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3 },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(playerRef.current?.getDuration() ?? 0);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              setPlaying(event.data === 1);
              if (event.data === 0) endedRef.current();
            },
            onError: () => {
              if (cancelled) return;
              /* Erreur souvent passagère (réseau, anti-robot YouTube) : une 2e
                 tentative est faite automatiquement avant d'afficher l'échec. */
              if (attemptsRef.current === 0) {
                attemptsRef.current = 1;
                window.setTimeout(() => {
                  const player = playerRef.current;
                  if (cancelled || !player) return;
                  loadedRef.current = '';
                  player.loadVideoById(videoRef.current.id);
                }, 900);
                return;
              }
              setFailed(true);
            },
          },
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* ignoré */ }
      playerRef.current = null;
      host.innerHTML = '';
    };
  }, []);

  /* Changement de piste : chargée SANS démarrer (changement d'onglet / auto-sélection),
     démarrée directement quand l'utilisateur a cliqué (playTick incrémenté). */
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    const tickChanged = lastTickRef.current !== playTick;
    const firstLoad = loadedRef.current === '';
    const isSame = loadedRef.current === video.id;
    lastTickRef.current = playTick;
    if (isSame && !tickChanged) return;
    loadedRef.current = video.id;
    if (firstLoad || !tickChanged) {
      player.cueVideoById(video.id);
    } else {
      player.loadVideoById(video.id);
    }
  }, [ready, video.id, playTick]);

  /* Progression et durée : rafraîchies 2× par seconde */
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setPosition(player.getCurrentTime());
      const d = player.getDuration();
      if (d > 0) setDuration(d);
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  const seekTo = (value: number) => {
    playerRef.current?.seekTo(value, true);
    setPosition(value);
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    playerRef.current?.setVolume(value);
  };

  if (failed) {
    return (
      <div className="pattern-geo rounded-2xl text-white p-6 text-center">
        <span className="text-4xl" aria-hidden="true">📻</span>
        <p className="font-bold mt-2">La lecture audio de cette piste a été refusée par YouTube.</p>
        <p className="text-sm text-white/70 mt-1">Essayez le mode vidéo, ou écoutez directement sur YouTube.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onFallbackToVideo} className="px-5 py-2.5 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition cursor-pointer">▶ Essayer en mode vidéo</button>
          <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-full ring-1 ring-white/40 text-white font-semibold hover:bg-white/10 transition">L&apos;écouter sur YouTube ↗</a>
        </div>
      </div>
    );
  }

  return (
    <div className="pattern-geo rounded-2xl text-white p-5 md:p-6">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-stretch">
        {/* Pochette : la vidéo YouTube reste affichée en miniature pendant l'écoute */}
        <div className="relative w-44 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/25 bg-black aspect-video">
          <div ref={hostRef} className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full" />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-gold text-[var(--green-deep)] text-[10px] font-extrabold tracking-wider">MP3</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center w-full text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-wider text-gold font-bold">🎧 Écoute audio</p>
          <h2 className="font-extrabold leading-snug line-clamp-2 mt-0.5">{video.title}</h2>
          <p className="text-xs text-white/60 mt-0.5">{video.author}</p>

          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.min(Math.floor(position), Math.floor(duration) || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Position de lecture"
            disabled={!ready || duration === 0}
            className="mt-3 w-full accent-[var(--gold)] cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-white/70 mt-0.5">
            <span>{fmtSecs(position)}</span>
            <span>{fmtSecs(duration)}</span>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!ready}
              aria-label={playing ? 'Mettre en pause' : 'Lecture'}
              className="w-12 h-12 grid place-items-center rounded-full bg-gold text-[var(--green-deep)] shadow-lg hover:bg-[var(--gold-light)] transition disabled:opacity-60 cursor-pointer"
            >
              {playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <span className="text-lg" aria-hidden="true">🔊</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="w-20 accent-[var(--gold)] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip ${active ? 'active' : ''} px-4 py-2 rounded-full ring-1 ring-[var(--sand)] bg-white text-sm font-semibold text-green-deep hover:bg-[var(--sand)] transition cursor-pointer`}
    >
      {label}
    </button>
  );
}

/* Clé sessionStorage : mémorise la session administrateur le temps de l'onglet
   courant (évite de retaper le mot de passe après un rechargement de la page). */
const ADMIN_SESSION_KEY = 'mosquee-admin-session';

/* ================= PAGE ================= */

export default function Page() {
  /* --- Navigation (SPA, comme la version vanilla-JS) --- */
  const [view, setView] = useState<ViewName>('home');
  const [currentCat, setCurrentCat] = useState<CategorySlug>('cours-audio');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* --- Recherche --- */
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterSlug>('tout');
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  /* --- Modales --- */
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; msg: string } | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [paymentResult, setPaymentResult] = useState<'success' | 'cancel' | null>(null);

  /* --- Formulaire de don --- */
  const [donPreset, setDonPreset] = useState<number | null>(2000);
  const [donCustom, setDonCustom] = useState('');
  const [donPurpose, setDonPurpose] = useState<Purpose>('don_libre');
  const [donName, setDonName] = useState('');
  const [donEmail, setDonEmail] = useState('');
  const [donPhone, setDonPhone] = useState('');
  const [donLoading, setDonLoading] = useState(false);
  const [donError, setDonError] = useState('');

  /* --- Valeurs client uniquement (jamais rendues côté serveur) --- */
  const [year, setYear] = useState('');
  const [todayLabel, setTodayLabel] = useState('');
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0]);
  const [prayers, setPrayers] = useState<PrayerTimesResult | null>(null);
  const [prayerError, setPrayerError] = useState(false);

  /* --- Médias YouTube (lecteur intégré) --- */
  const [mediaCat, setMediaCat] = useState<MediaSlug>('chaine');
  const [mediaData, setMediaData] = useState<MediaPayload | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [currentVideo, setCurrentVideo] = useState<MediaVideo | null>(null);
  const [mediaReload, setMediaReload] = useState(0);
  const [audioMode, setAudioMode] = useState(false);
  const [audioPlayTick, setAudioPlayTick] = useState(0);
  const mediaCacheRef = useRef<Partial<Record<MediaSlug, MediaPayload>>>({});
  const playerRef = useRef<HTMLDivElement | null>(null);

  /* --- Événements (chargés depuis la base via /api/events) --- */
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const [eventsReload, setEventsReload] = useState(0);

  /* --- Audios hébergés (recommandations de l'Imam) — section « Les nouveautés » --- */
  const [hostedAudios, setHostedAudios] = useState<AudioItem[] | null>(null);

  /* --- Panneau d'administration des événements --- */
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [adminList, setAdminList] = useState<EventItem[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | 'new' | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evPlace, setEvPlace] = useState('');
  const [evImage, setEvImage] = useState('');
  const [evUploading, setEvUploading] = useState(false);
  const [evImgError, setEvImgError] = useState('');
  const [evSaving, setEvSaving] = useState(false);
  const [evError, setEvError] = useState('');

  /* --- Gestion des audios hébergés (onglet « Audios » du panneau d'admin) --- */
  const [adminSection, setAdminSection] = useState<'events' | 'audios'>('events');
  const [adminAudioList, setAdminAudioList] = useState<AudioItem[]>([]);
  const [confirmDelAudioId, setConfirmDelAudioId] = useState<number | null>(null);
  const [auTitle, setAuTitle] = useState('');
  const [auFileUrl, setAuFileUrl] = useState('');
  const [auFileName, setAuFileName] = useState('');
  const [auLink, setAuLink] = useState('');
  const [auUploading, setAuUploading] = useState(false);
  const [auSaving, setAuSaving] = useState(false);
  const [auError, setAuError] = useState('');
  const [audioMsg, setAudioMsg] = useState('');

  const navigate = (next: ViewName, slug?: CategorySlug) => {
    if (next === 'categorie' && slug) setCurrentCat(slug);
    setView(next);
    setBrowseOpen(false);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* Ouvre la page Médias sur l'onglet demandé */
  const openMedia = (cat: MediaSlug) => {
    setMediaCat(cat);
    setAudioMode(defaultAudioMode(cat));
    setView('media');
    setBrowseOpen(false);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showInfo = (title: string, msg: string) => setInfoModal({ title, msg });

  const closeDonate = () => {
    setDonateOpen(false);
    setDonError('');
  };

  const closeAllModals = () => {
    setDetailItem(null);
    setInfoModal(null);
    setDonateOpen(false);
    setPaymentResult(null);
    setAdminOpen(false);
  };

  /* Date du jour, année du footer et résultat de paiement PayTech (?payment=success|cancel) */
  useEffect(() => {
    setYear(String(new Date().getFullYear()));
    setTodayLabel(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }));

    const payment = new URLSearchParams(window.location.search).get('payment');
    if (payment === 'success' || payment === 'cancel') {
      setPaymentResult(payment);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  /* Horaires de prière : bibliothèque Adhan chargée en module ESM (comme l'original) */
  useEffect(() => {
    let cancelled = false;

    const compute = () => {
      const Adhan = window.adhan;
      if (!Adhan || cancelled) return;
      try {
        /* Coordonnées de Bingerville (Côte d'Ivoire) — méthode MWL, école Chafi'i */
        const coordinates = new Adhan.Coordinates(5.35, -3.8833);
        const params = Adhan.CalculationMethod.MuslimWorldLeague();
        params.madhab = Adhan.Madhab.Shafi;
        const pt = new Adhan.PrayerTimes(coordinates, new Date(), params);
        setPrayers(pt);
      } catch {
        setPrayerError(true);
      }
    };

    window.addEventListener('adhan-ready', compute);
    if (window.adhan) compute();

    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = "import('https://cdn.jsdelivr.net/npm/adhan@4.4.4/+esm').then(m=>{window.adhan=m;window.dispatchEvent(new Event('adhan-ready'));}).catch(e=>console.warn('Adhan non chargé',e));";
    document.head.appendChild(s);

    return () => {
      cancelled = true;
      window.removeEventListener('adhan-ready', compute);
      s.remove();
    };
  }, []);

  /* Compteurs animés (rAF), démarrés à 0 → hydratation sûre */
  useEffect(() => {
    const timeouts: number[] = [];
    const rafs: number[] = [];
    STATS.forEach((stat, i) => {
      let cur = 0;
      const step = Math.max(1, stat.target / 60);
      const tick = () => {
        cur += step;
        if (cur < stat.target) {
          setCounts(prev => prev.map((v, j) => (j === i ? Math.floor(cur) : v)));
          rafs[i] = window.requestAnimationFrame(tick);
        } else {
          setCounts(prev => prev.map((v, j) => (j === i ? stat.target : v)));
        }
      };
      timeouts.push(window.setTimeout(tick, 200));
    });
    return () => {
      timeouts.forEach(t => window.clearTimeout(t));
      rafs.forEach(r => window.cancelAnimationFrame(r));
    };
  }, []);

  /* Verrouille le scroll quand une modale est ouverte */
  useEffect(() => {
    const anyOpen = detailItem !== null || infoModal !== null || donateOpen || paymentResult !== null || adminOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [detailItem, infoModal, donateOpen, paymentResult, adminOpen]);

  /* Échap ferme toutes les modales */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAllModals();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Charge les vidéos YouTube de l'onglet actif (cache mémoire client, une requête par onglet) */
  useEffect(() => {
    if (view !== 'media') return;
    const cached = mediaCacheRef.current[mediaCat];
    if (cached) {
      setMediaData(cached);
      setMediaError('');
      setMediaLoading(false);
      setCurrentVideo(null);
      return;
    }
    let cancelled = false;
    setMediaLoading(true);
    setMediaError('');
    setMediaData(null);
    setCurrentVideo(null);
    fetch(`/api/media?category=${encodeURIComponent(mediaCat)}`)
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok || data === null) throw new Error('réponse invalide');
        const payload = asMediaPayload(data);
        if (!payload) throw new Error('format inattendu');
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        mediaCacheRef.current[mediaCat] = payload;
        setMediaData(payload);
      })
      .catch(() => {
        if (cancelled) return;
        setMediaError('Vérifiez votre connexion internet, puis réessayez.');
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, mediaCat, mediaReload]);

  /* Mode audio : sélectionne automatiquement la 1re piste si aucune n'est choisie */
  useEffect(() => {
    if (view !== 'media' || !audioMode || currentVideo !== null) return;
    if (mediaData === null || mediaData.videos.length === 0) return;
    setCurrentVideo(mediaData.videos[0]);
  }, [view, audioMode, currentVideo, mediaData]);

  /* Mode audio : enchaîne automatiquement la piste suivante à la fin d'une piste */
  const playNextAudio = () => {
    if (mediaData === null || currentVideo === null) return;
    const list = mediaData.videos;
    const idx = list.findIndex(v => v.id === currentVideo.id);
    const next = idx >= 0 ? list[idx + 1] : undefined;
    if (next) {
      setCurrentVideo(next);
      setAudioPlayTick(t => t + 1);
    }
  };

  /* Charge les événements de la mosquée (base de données, modifiables sans toucher au code) */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/events', { cache: 'no-store' })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok || data === null) throw new Error('réponse invalide');
        return asEventList(data);
      })
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        setEventsError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEventsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventsReload]);

  /* Charge les audios hébergés par la mosquée (section « Les nouveautés » de l'accueil) */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/audios', { cache: 'no-store' })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok || data === null) throw new Error('réponse invalide');
        return asAudioList(data);
      })
      .then((list) => {
        if (cancelled) return;
        setHostedAudios(list);
      })
      .catch(() => {
        if (cancelled) return;
        setHostedAudios([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Administration des événements --- */

  /* Vérifie le mot de passe auprès du serveur et met à jour les listes si valide.
     'ok' → connecté · 'refused' → mot de passe incorrect · 'network' → serveur injoignable. */
  const verifyAdminPassword = async (pwd: string): Promise<'ok' | 'refused' | 'network'> => {
    try {
      const res = await fetch('/api/events', { cache: 'no-store', headers: { 'x-admin-password': pwd } });
      if (res.status === 401) return 'refused';
      if (!res.ok) return 'network';
      const data: unknown = await res.json();
      const list = asEventList(data);
      setEvents(list);
      setAdminList(list);
      return 'ok';
    } catch {
      return 'network';
    }
  };

  /* Requête admin : ajoute le mot de passe dans l'en-tête. Si le serveur répond
     401 alors que la connexion avait réussi (incident passager), la vérification
     est refaite puis la requête retentée UNE seule fois avant d'échouer. */
  const adminFetch = async (
    pwd: string,
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {}
  ): Promise<Response> => {
    const send = (p: string) =>
      fetch(url, { ...init, cache: 'no-store', headers: { ...init.headers, 'x-admin-password': p } });
    const first = await send(pwd);
    if (first.status !== 401 || pwd.length === 0) return first;
    if ((await verifyAdminPassword(pwd)) !== 'ok') return first;
    return send(pwd);
  };

  /* Recharge la liste depuis l'API et met à jour l'affichage public ET le panneau */
  const refreshEvents = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/events', { cache: 'no-store' });
      const data: unknown = await res.json();
      if (!res.ok) return false;
      const list = asEventList(data);
      setEvents(list);
      setAdminList(list);
      return true;
    } catch {
      return false;
    }
  };

  const openAdmin = () => {
    setAdminOpen(true);
    setAdminError('');
    setAdminMsg('');
    setEditingEvent(null);
    setConfirmDelId(null);
    if (adminAuthed) {
      setAdminLoading(true);
      void refreshEvents().finally(() => setAdminLoading(false));
      return;
    }
    /* Session mémorisée dans cet onglet ? On se reconnecte automatiquement. */
    let savedPwd = '';
    try {
      savedPwd = window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? '';
    } catch {
      savedPwd = '';
    }
    if (savedPwd.length > 0) {
      setAdminPwd(savedPwd);
      setAdminLoading(true);
      void verifyAdminPassword(savedPwd)
        .then((state) => {
          if (state === 'ok') {
            setAdminAuthed(true);
          } else {
            try {
              window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
            } catch {
              /* ignoré */
            }
            setAdminPwd('');
          }
        })
        .finally(() => setAdminLoading(false));
    }
  };

  const closeAdmin = () => {
    setAdminOpen(false);
    setAdminError('');
    setEditingEvent(null);
    setConfirmDelId(null);
    setConfirmDelAudioId(null);
  };

  /* Connexion : l'API refuse (401) si le mot de passe ne correspond pas à ADMIN_PASSWORD.
     En cas de succès, la session est mémorisée dans l'onglet (sessionStorage). */
  const handleAdminLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (adminLoading || adminPwd.length === 0) return;
    setAdminLoading(true);
    setAdminError('');
    const state = await verifyAdminPassword(adminPwd);
    if (state === 'ok') {
      setAdminAuthed(true);
      setAdminMsg('');
      try {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, adminPwd);
      } catch {
        /* ignoré */
      }
    } else if (state === 'refused') {
      setAdminError('Mot de passe incorrect.');
    } else {
      setAdminError('Connexion impossible. Vérifiez votre connexion internet.');
    }
    setAdminLoading(false);
  };

  const handleAdminLogout = () => {
    setAdminAuthed(false);
    setAdminPwd('');
    setAdminError('');
    setAdminMsg('');
    setAdminSection('events');
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignoré */
    }
  };

  const startNewEvent = () => {
    setEditingEvent('new');
    setEvTitle('');
    setEvDate('');
    setEvTime('');
    setEvPlace('');
    setEvImage('');
    setEvImgError('');
    setEvError('');
    setAdminMsg('');
  };

  const startEditEvent = (ev: EventItem) => {
    setEditingEvent(ev);
    setEvTitle(ev.title);
    setEvDate(ev.date);
    setEvTime(ev.time);
    setEvPlace(ev.place);
    setEvImage(ev.imageUrl);
    setEvImgError('');
    setEvError('');
    setAdminMsg('');
  };

  const cancelEditEvent = () => {
    setEditingEvent(null);
    setEvError('');
    setEvImgError('');
  };

  /* Hébergement d'une image choisie par l'administrateur : le fichier est envoyé
     à /api/upload (protégé par le mot de passe admin) qui le stocke sur le site
     et renvoie son adresse /uploads/… , utilisée comme image de l'événement. */
  const handleImageUpload = async (file: File) => {
    if (evUploading) return;
    if (adminPwd.length === 0) {
      setEvImgError('Votre session a expiré. Veuillez vous reconnecter.');
      return;
    }
    setEvImgError('');
    setEvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await adminFetch(adminPwd, '/api/upload', { method: 'POST', body: fd });
      if (res.status === 401) {
        handleAdminLogout();
        setEditingEvent(null);
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      const url = typeof data === 'object' && data !== null && 'url' in data ? (data as { url: unknown }).url : null;
      if (!res.ok || typeof url !== 'string' || url.length === 0) {
        const msg = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
        setEvImgError(typeof msg === 'string' && msg.length > 0 ? msg : 'Hébergement de l\'image impossible. Veuillez réessayer.');
        return;
      }
      setEvImage(url);
    } catch {
      setEvImgError('Hébergement de l\'image impossible. Vérifiez votre connexion internet.');
    } finally {
      setEvUploading(false);
    }
  };

  const handleEventSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (evSaving || editingEvent === null) return;
    /* Validation côté client (la même règle est appliquée côté serveur) */
    if (evTitle.trim().length === 0) {
      setEvError("Veuillez saisir le titre de l'événement.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evDate)) {
      setEvError('Veuillez choisir une date valide.');
      return;
    }
    if (evTime.length > 0 && !/^([01]\d|2[0-3]):[0-5]\d$/.test(evTime)) {
      setEvError('Veuillez saisir une heure valide (ex. 18:30).');
      return;
    }
    if (evPlace.trim().length > 200) {
      setEvError('Le lieu est trop long (200 caractères maximum).');
      return;
    }

    const eventId = editingEvent === 'new' ? null : editingEvent.id;
    const isCreate = eventId === null;
    setEvSaving(true);
    setEvError('');
    try {
      const res = await adminFetch(adminPwd, eventId === null ? '/api/events' : `/api/events/${eventId}`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: evTitle.trim(), date: evDate, time: evTime, place: evPlace.trim(), imageUrl: evImage }),
      });
      if (res.status === 401) {
        handleAdminLogout();
        setEditingEvent(null);
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
        setEvError(typeof msg === 'string' && msg.length > 0 ? msg : 'Enregistrement impossible. Veuillez réessayer.');
        return;
      }
      const ok = await refreshEvents();
      setEditingEvent(null);
      setAdminMsg(ok
        ? (isCreate ? '✓ Événement ajouté. Il apparaît déjà sur le site.' : '✓ Événement modifié.')
        : 'Enregistré, mais le rafraîchissement de la liste a échoué.');
    } catch {
      setEvError('Enregistrement impossible. Vérifiez votre connexion internet.');
    } finally {
      setEvSaving(false);
    }
  };

  /* Suppression en deux temps (bouton « Supprimer » puis « Confirmer ») */
  const handleDeleteEvent = async (id: number) => {
    if (adminBusy) return;
    setAdminBusy(true);
    setAdminError('');
    try {
      const res = await adminFetch(adminPwd, `/api/events/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleAdminLogout();
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      if (!res.ok) {
        setAdminError('Suppression impossible. Veuillez réessayer.');
        return;
      }
      const ok = await refreshEvents();
      setAdminMsg(ok ? '✓ Événement supprimé.' : 'Supprimé, mais le rafraîchissement de la liste a échoué.');
    } catch {
      setAdminError('Suppression impossible. Vérifiez votre connexion internet.');
    } finally {
      setAdminBusy(false);
      setConfirmDelId(null);
    }
  };

  /* --- Gestion des audios hébergés (onglet « Audios ») --- */

  /* Recharge la liste des audios : affichage public + panneau d'admin */
  const refreshAudios = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/audios', { cache: 'no-store' });
      const data: unknown = await res.json();
      if (!res.ok) return false;
      const list = asAudioList(data);
      setHostedAudios(list);
      setAdminAudioList(list);
      return true;
    } catch {
      return false;
    }
  };

  /* Hébergement du fichier audio choisi par l'administrateur : envoyé à
     /api/upload (protégé par le mot de passe admin) qui le stocke sur le site
     et renvoie son adresse /uploads/… , publiée ensuite dans « Les nouveautés ». */
  const handleAudioUpload = async (file: File) => {
    if (auUploading) return;
    if (adminPwd.length === 0) {
      setAuError('Votre session a expiré. Veuillez vous reconnecter.');
      return;
    }
    setAuError('');
    setAuUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await adminFetch(adminPwd, '/api/upload', { method: 'POST', body: fd });
      if (res.status === 401) {
        handleAdminLogout();
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      const url = typeof data === 'object' && data !== null && 'url' in data ? (data as { url: unknown }).url : null;
      const kind = typeof data === 'object' && data !== null && 'kind' in data ? (data as { kind: unknown }).kind : null;
      if (!res.ok || typeof url !== 'string' || url.length === 0) {
        const msg = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
        setAuError(typeof msg === 'string' && msg.length > 0 ? msg : "Hébergement du fichier impossible. Veuillez réessayer.");
        return;
      }
      if (kind !== 'audio') {
        setAuError("Le fichier choisi n'est pas un fichier audio.");
        return;
      }
      setAuFileUrl(url);
      setAuFileName(file.name);
      /* Titre pré-rempli avec le nom du fichier (sans extension) si vide */
      if (auTitle.trim().length === 0) {
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (base.length > 0) setAuTitle(base.slice(0, 150));
      }
    } catch {
      setAuError('Hébergement du fichier impossible. Vérifiez votre connexion internet.');
    } finally {
      setAuUploading(false);
    }
  };

  /* Publication : enregistre le titre + le fichier hébergé (ou le lien externe
     collé) → visible dans « Les nouveautés ». Un lien https collé a la priorité
     sur un fichier téléversé : pratique pour les gros MP3 (Internet Archive…). */
  const handleAudioPublish = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (auSaving || auUploading) return;
    if (auTitle.trim().length === 0) {
      setAuError("Veuillez saisir le titre de l'audio.");
      return;
    }
    const linkTrim = auLink.trim();
    const linkValid = /^https:\/\/\S+$/.test(linkTrim);
    const finalUrl = linkValid ? linkTrim : auFileUrl;
    if (finalUrl.length === 0) {
      setAuError('Veuillez choisir un fichier audio à héberger ou coller un lien https.');
      return;
    }
    if (linkTrim.length > 0 && !linkValid) {
      setAuError('Le lien doit commencer par https:// (ex. https://archive.org/…/conference.mp3).');
      return;
    }
    setAuSaving(true);
    setAuError('');
    try {
      const res = await adminFetch(adminPwd, '/api/audios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: auTitle.trim(), audioUrl: finalUrl }),
      });
      if (res.status === 401) {
        handleAdminLogout();
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
        setAuError(typeof msg === 'string' && msg.length > 0 ? msg : 'Publication impossible. Veuillez réessayer.');
        return;
      }
      setAuTitle('');
      setAuFileUrl('');
      setAuFileName('');
      setAuLink('');
      const ok = await refreshAudios();
      setAudioMsg(ok ? '✓ Audio publié. Il apparaît en tête de la section « Les nouveautés ».' : 'Publié, mais le rafraîchissement de la liste a échoué.');
    } catch {
      setAuError('Publication impossible. Vérifiez votre connexion internet.');
    } finally {
      setAuSaving(false);
    }
  };

  /* Suppression d'un audio hébergé (en deux temps : « Supprimer » puis « Confirmer ») */
  const handleDeleteAudio = async (id: number) => {
    if (adminBusy) return;
    setAdminBusy(true);
    setAuError('');
    try {
      const res = await adminFetch(adminPwd, `/api/audios/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleAdminLogout();
        setAdminError('Votre session a expiré. Veuillez vous reconnecter.');
        return;
      }
      if (!res.ok) {
        setAuError('Suppression impossible. Veuillez réessayer.');
        return;
      }
      const ok = await refreshAudios();
      setAudioMsg(ok ? '✓ Audio supprimé.' : 'Supprimé, mais le rafraîchissement de la liste a échoué.');
    } catch {
      setAuError('Suppression impossible. Vérifiez votre connexion internet.');
    } finally {
      setAdminBusy(false);
      setConfirmDelAudioId(null);
    }
  };

  /* --- Données dérivées --- */

  /* Événements à venir uniquement (les passés restent visibles dans le panneau d'admin) */
  const upcomingEvents = useMemo(() => {
    if (events === null) return [];
    const today = new Date().toISOString().slice(0, 10);
    return events.filter(ev => ev.date >= today);
  }, [events]);

  const recommended = useMemo(() => CONTENT.filter(c => c.rec).slice(0, 4), []);

  /* « Les nouveautés » : les derniers contenus AUDIO publiés (prêches, cours,
     conférences, podcasts) — comme demandé par l'administration de la mosquée. */
  const recent = useMemo(
    () =>
      [...CONTENT]
        .filter(c => isAudioCat(c.c))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    []
  );

  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = CONTENT.filter(it => {
      const okCat = activeFilter === 'tout' || it.c === activeFilter;
      const okQ = !q || it.t.toLowerCase().includes(q) || it.d.toLowerCase().includes(q) || CATS[it.c].label.toLowerCase().includes(q);
      return okCat && okQ;
    });
    if (sortBy === 'recent') list = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sortBy === 'popular') list = [...list].sort((a, b) => b.views - a.views);
    if (sortBy === 'az') list = [...list].sort((a, b) => a.t.localeCompare(b.t));
    return list;
  }, [query, activeFilter, sortBy]);

  const catItems = useMemo(() => CONTENT.filter(c => c.c === currentCat), [currentCat]);

  /* Mode audio : piste active (1re de la liste si aucune n'a encore été choisie) */
  const audioVideo: MediaVideo | null = currentVideo
    ? currentVideo
    : view === 'media' && mediaData !== null && mediaData.videos.length > 0
      ? mediaData.videos[0]
      : null;

  /* Source du lecteur intégré : vidéo choisie (contexte playlist, autoplay) sinon lecteur de playlist */
  const playerSrc = (() => {
    if (currentVideo) {
      const listParam = mediaCat !== 'chaine' ? `&list=${PLAYLIST_BY_CAT[mediaCat]}` : '';
      return `https://www.youtube.com/embed/${currentVideo.id}?autoplay=1&rel=0${listParam}`;
    }
    if (mediaData && mediaData.videos.length > 0 && mediaData.playlistId) {
      return `https://www.youtube.com/embed/videoseries?list=${mediaData.playlistId}`;
    }
    return null;
  })();

  /* Montant du don : champ libre prioritaire, sinon preset */
  const customNum = donCustom.trim() !== '' ? Number(donCustom) : NaN;
  const donAmount: number | null = Number.isFinite(customNum) ? customNum : donPreset;

  const donPresetBtnClass = (v: number) =>
    `px-3 py-2.5 rounded-xl text-sm font-bold transition ring-1 ${
      donPreset === v
        ? 'bg-green-deep text-white ring-[var(--green-deep)]'
        : 'bg-white text-green-deep ring-[var(--sand)] hover:bg-[var(--cream)]'
    }`;

  const handleDonate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDonError('');
    if (donAmount === null || !Number.isInteger(donAmount) || donAmount < DON_MIN || donAmount > DON_MAX) {
      setDonError('Veuillez saisir un montant valide (minimum 500 FCFA).');
      return;
    }
    setDonLoading(true);
    try {
      const res = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: donAmount,
          purpose: donPurpose,
          donorName: donName || undefined,
          donorEmail: donEmail || undefined,
          donorPhone: donPhone || undefined,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      const redirectUrl = getRedirectUrl(data);
      if (res.ok && redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setDonError(getDonateError(data));
      }
    } catch {
      setDonError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setDonLoading(false);
    }
  };

  /* Horaires de prière affichables (client uniquement) */
  const prayerList: Array<[string, Date]> | null = prayers
    ? [
        ['Fajr', prayers.fajr],
        ['Dhuhr', prayers.dhuhr],
        ['Asr', prayers.asr],
        ['Maghrib', prayers.maghrib],
        ['Isha', prayers.isha],
      ]
    : null;

  let nextPrayerLabel = '—';
  if (prayerList) {
    const now = new Date();
    const next = prayerList.find(([, t]) => t > now);
    nextPrayerLabel = next ? `${next[0]} — ${fmtTime(next[1])}` : `Fajr (demain) — ${fmtTime(prayerList[0][1])}`;
  }

  return (
    <div>
      {/* ============ TOP BAR ============ */}
      <div className="pattern-geo text-white text-xs md:text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="font-ar text-gold text-base">بسم الله الرحمن الرحيم</p>
          <div className="flex items-center gap-4 text-white/80">
            <span className="hidden sm:inline">📍 94HF+PR6, Bingerville</span>
            <a href="https://wa.me/2250747008005" target="_blank" rel="noreferrer" className="hover:text-gold">💬 WhatsApp : 07 47 00 80 05</a>
          </div>
        </div>
      </div>

      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 bg-[var(--cream)]/95 backdrop-blur border-b border-[var(--sand)]">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <button type="button" onClick={() => navigate('home')} className="flex items-center gap-3 group cursor-pointer">
            <img src={LOGO_URL} alt="Logo Mosquée Hadja Yah Diakite" className="w-14 h-14 rounded-full object-cover shadow-lg ring-2 ring-[var(--gold)]/50 bg-white" />
            <div className="text-left leading-tight">
              <span className="block text-lg font-extrabold text-green-deep">Mosquée Hadja Yah Diakite</span>
              <span className="block text-[11px] tracking-wider uppercase text-[var(--green-light)] font-semibold">Apprendre l'Islam authentique</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-semibold text-green-deep">
            <button type="button" className="nav-underline cursor-pointer" onClick={() => navigate('home')}>Accueil</button>
            <div className="relative" onMouseEnter={() => setBrowseOpen(true)} onMouseLeave={() => setBrowseOpen(false)}>
              <button type="button" className="nav-underline flex items-center gap-1 cursor-pointer" aria-haspopup="true" aria-expanded={browseOpen}>
                Parcourir
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 w-56 transition-all ${browseOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <div className="bg-white rounded-xl shadow-2xl ring-1 ring-[var(--sand)] p-2 grid">
                  <button type="button" className="px-4 py-2 rounded-lg hover:bg-[var(--cream)] cursor-pointer flex items-center gap-2 text-left font-semibold text-[#c4302b]" onClick={() => openMedia('chaine')}>
                    ▶ Écouter sur le site
                  </button>
                  <div className="h-px bg-[var(--sand)] my-1" aria-hidden="true"></div>
                  {NAV_CATS.map(slug => (
                    <button key={slug} type="button" className="px-4 py-2 rounded-lg hover:bg-[var(--cream)] cursor-pointer flex items-center gap-2 text-left" onClick={() => navigate('categorie', slug)}>
                      {CATS[slug].icon} {CATS[slug].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" className="nav-underline cursor-pointer" onClick={() => openMedia('chaine')}>Médias</button>
            <button type="button" className="nav-underline cursor-pointer" onClick={() => navigate('evenements')}>Événements</button>
            <button type="button" className="nav-underline cursor-pointer" onClick={() => navigate('recherche')}>Recherche</button>
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('recherche')} className="w-10 h-10 grid place-items-center rounded-full bg-white ring-1 ring-[var(--sand)] hover:bg-[var(--sand)] transition cursor-pointer" aria-label="Recherche">
              <svg className="w-5 h-5 text-green-deep" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            </button>
            <button type="button" onClick={() => { setMobileOpen(false); setDonateOpen(true); }} className="hidden sm:inline-flex px-5 py-2.5 rounded-full bg-green-deep text-white text-sm font-semibold hover:bg-[var(--green)] transition shadow-lg cursor-pointer">Faire un don</button>
            <button type="button" onClick={() => setMobileOpen(o => !o)} className="lg:hidden w-10 h-10 grid place-items-center rounded-full bg-white ring-1 ring-[var(--sand)] cursor-pointer" aria-label="Ouvrir le menu" aria-expanded={mobileOpen}>
              <svg className="w-6 h-6 text-green-deep" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-[var(--sand)] px-4 py-4 space-y-1 text-green-deep font-semibold">
            <button type="button" className="block py-2 cursor-pointer text-left" onClick={() => navigate('home')}>Accueil</button>
            <p className="pt-2 text-xs uppercase text-[var(--green-light)]">Parcourir</p>
            {NAV_CATS.map(slug => (
              <button key={slug} type="button" className="block py-1.5 pl-3 cursor-pointer text-left" onClick={() => navigate('categorie', slug)}>
                {CATS[slug].icon} {CATS[slug].label}
              </button>
            ))}
            <button type="button" className="block py-2 cursor-pointer text-left font-semibold text-[#c4302b]" onClick={() => openMedia('chaine')}>▶ Médias — écouter sur le site</button>
            <button type="button" className="block py-2 cursor-pointer text-left" onClick={() => navigate('evenements')}>Événements</button>
            <button type="button" className="block py-2 cursor-pointer text-left" onClick={() => navigate('recherche')}>Recherche</button>
            <button type="button" className="block py-2 cursor-pointer text-left" onClick={() => { setMobileOpen(false); setDonateOpen(true); }}>Faire un don</button>
          </div>
        )}
      </header>

      <main>
        {/* ================= HOME VIEW ================= */}
        {view === 'home' && (
          <section className="view active">
            {/* HERO */}
            <div className="relative pattern-geo text-white overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--green-deep)] via-[var(--green-deep)]/70 to-transparent"></div>
              <img src="https://images.pexels.com/photos/29903474/pexels-photo-29903474.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600" className="absolute inset-0 w-full h-full object-cover opacity-25" alt="Mosquée" />
              <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 ring-1 ring-white/25 text-sm font-semibold text-gold backdrop-blur">
                    <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span> Bienvenue à la mosquée
                  </span>
                  <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight">Imam Dr <span className="text-gold">Bako Isaac Aboubacar</span></h1>
                  <p className="mt-4 text-lg text-white/85 max-w-lg">Que la paix et la miséricorde d'Allah soient sur vous. Découvrez l'enseignement authentique de l'Islam à travers des milliers de contenus : prêches, conférences, cours et rappels bénéfiques.</p>
                  <p className="mt-3 font-ar text-2xl text-gold opacity-90">السلام عليكم ورحمة الله وبركاته</p>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <button type="button" onClick={() => navigate('recherche')} className="px-7 py-3.5 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition shadow-xl cursor-pointer">Explorer la bibliothèque</button>
                    <button type="button" onClick={() => openMedia('preches')} className="px-7 py-3.5 rounded-full ring-1 ring-white/40 text-white font-semibold hover:bg-white/10 transition cursor-pointer">Écouter un prêche</button>
                  </div>
                </div>

                {/* Prayer times card */}
                <div className="bg-white/10 backdrop-blur-md ring-1 ring-white/20 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">🕌 Horaires des prières</h3>
                    <span className="text-sm text-white/70">{todayLabel}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {prayerError && !prayers ? (
                      <p className="col-span-3 text-white/60 text-sm py-4">Horaires indisponibles pour le moment.</p>
                    ) : prayerList ? (
                      prayerList.map(([n, t]) => (
                        <div key={n} className="rounded-xl bg-white/10 py-2">
                          <p className="text-xs text-white/70">{n}</p>
                          <p className="font-bold text-gold">{fmtTime(t)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="col-span-3 text-white/60 text-sm py-4">Calcul des horaires en cours…</p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between text-sm">
                    <span className="text-white/70">Prochaine prière</span>
                    <span className="font-bold text-gold">{nextPrayerLabel}</span>
                  </div>
                </div>
              </div>

              {/* stats strip */}
              <div className="relative border-t border-white/10 bg-black/20">
                <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {STATS.map((stat, i) => (
                    <div key={stat.label}>
                      <p className="text-3xl font-extrabold text-gold">{counts[i].toLocaleString('fr-FR')}</p>
                      <p className="text-sm text-white/70">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RECOMMANDATIONS DE L'IMAM */}
            <section className="max-w-7xl mx-auto px-4 py-16">
              <div className="flex items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-[var(--green-light)] font-bold uppercase tracking-wider text-sm">✦ Sélection de l'Imam</span>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-green-deep mt-1">Ce que l'Imam vous recommande</h2>
                </div>
                <button type="button" onClick={() => navigate('recherche')} className="hidden sm:inline-flex items-center gap-1 text-green-deep font-semibold hover:text-[var(--green-light)] cursor-pointer">
                  Tout voir
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommended.map(item => <ContentCard key={item.id} item={item} onOpen={setDetailItem} />)}
              </div>
            </section>

            {/* NOUVEAUTÉS — audios hébergés par la mosquée + derniers contenus audio de la chaîne */}
            <section className="pattern-sand py-16">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-end justify-between gap-4 mb-8">
                  <div>
                    <span className="text-[var(--green-light)] font-bold uppercase tracking-wider text-sm">✦ Récemment publié</span>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-green-deep mt-1">Les nouveautés</h2>
                    <p className="text-[var(--ink)]/60 mt-1">Les audios recommandés par l&apos;Imam, puis les derniers prêches, cours, conférences et podcasts — à écouter en un clic</p>
                  </div>
                </div>

                {/* Audios hébergés par l'administration (recommandations de l'Imam) */}
                {hostedAudios !== null && hostedAudios.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {hostedAudios.map(a => <HostedAudioCard key={a.id} audio={a} />)}
                  </div>
                )}
                {hostedAudios !== null && hostedAudios.length > 0 && (
                  <div className="flex items-center gap-3 my-8" aria-hidden="true">
                    <span className="h-px flex-1 bg-[var(--sand)]"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]/45">Derniers contenus de la chaîne</span>
                    <span className="h-px flex-1 bg-[var(--sand)]"></span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recent.map(item => <ContentCard key={item.id} item={item} onOpen={setDetailItem} />)}
                </div>
              </div>
            </section>

            {/* NOTRE BIBLIOTHÈQUE */}
            <section className="relative pattern-geo text-white py-20">
              <div className="max-w-7xl mx-auto px-4 text-center">
                <span className="font-ar text-3xl text-gold">المكتبة</span>
                <h2 className="text-3xl md:text-5xl font-extrabold mt-2">Notre bibliothèque</h2>
                <p className="text-white/80 mt-3 max-w-xl mx-auto">Des milliers de contenus à votre disposition. Explorez par catégorie et nourrissez votre foi.</p>
                <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                  {ALL_CATS.map(slug => <CategoryCard key={slug} slug={slug} cat={CATS[slug]} onOpen={s => navigate('categorie', s)} />)}
                </div>
              </div>
            </section>

            {/* DON — NOUVELLE SECTION CTA */}
            <section className="max-w-7xl mx-auto px-4 py-16">
              <div className="pattern-geo rounded-3xl text-white text-center px-6 py-14 md:py-16">
                <p className="font-ar text-3xl md:text-4xl text-gold">مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ</p>
                <h2 className="text-3xl md:text-5xl font-extrabold mt-3">Soutenez votre mosquée</h2>
                <p className="text-white/80 mt-4 max-w-2xl mx-auto">La mosquée vit grâce à votre générosité : entretien, cours, actions caritatives et projets. Participez selon vos moyens, même d'un petit montant.</p>
                <button type="button" onClick={() => setDonateOpen(true)} className="mt-8 px-9 py-4 rounded-full bg-gold text-[var(--green-deep)] font-extrabold text-lg hover:bg-[var(--gold-light)] transition shadow-xl cursor-pointer">❤ Faire un don</button>
                <p className="mt-7 text-sm text-white/60">Orange Money · Wave · MTN MoMo · Moov Money · Carte bancaire — paiement sécurisé via PayTech</p>
              </div>
            </section>

            {/* RÉSEAUX SOCIAUX — abonnez-vous à nos chaînes */}
            <section className="max-w-7xl mx-auto px-4 py-16">
              <div className="pattern-geo rounded-3xl overflow-hidden text-white text-center px-6 py-12 md:py-16">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 ring-1 ring-white/25 text-sm font-semibold text-gold backdrop-blur">✦ Restons connectés</span>
                <h3 className="text-2xl md:text-4xl font-extrabold mt-4">Abonnez-vous à nos chaînes</h3>
                <p className="text-white/75 mt-3 max-w-2xl mx-auto">Recevez les prêches, cours, conférences et annonces de la mosquée en suivant nos pages officielles sur les réseaux sociaux.</p>
                <div className="mt-9 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  {SOCIALS.map(s => (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`${s.bg} rounded-2xl px-4 py-6 flex flex-col items-center gap-2.5 font-bold text-white shadow-xl transition hover:scale-[1.04] hover:shadow-2xl`}
                    >
                      {s.icon}
                      <span className="text-base">{s.name}</span>
                      <span className="text-[11px] font-medium text-white/80 break-words leading-tight max-w-full">{s.sub}</span>
                    </a>
                  ))}
                </div>
                <p className="mt-8 text-sm text-white/60">BarakAllahu fik pour votre soutien — partagez le savoir autour de vous.</p>
              </div>
            </section>
          </section>
        )}

        {/* ================= RECHERCHE VIEW ================= */}
        {view === 'recherche' && (
          <section className="view active">
            <div className="pattern-geo text-white py-12">
              <div className="max-w-7xl mx-auto px-4">
                <h1 className="text-3xl md:text-4xl font-extrabold">Recherche</h1>
                <p className="text-white/75 mt-1">Trouvez un cours, une conférence, un prêche, un podcast, une vidéo ou un article.</p>
                <div className="mt-6 relative max-w-2xl">
                  <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--green-deep)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher : ex. Ramadan, patience, Coran…"
                    aria-label="Rechercher un contenu"
                    className="w-full pl-12 pr-5 py-4 rounded-full text-[var(--ink)] focus:outline-none focus:ring-2 ring-[var(--gold)] text-lg shadow-2xl"
                  />
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-10">
              {/* Filter chips */}
              <div className="flex flex-wrap gap-2 mb-8">
                <Chip label="Tout" active={activeFilter === 'tout'} onClick={() => setActiveFilter('tout')} />
                {ALL_CATS.map(slug => (
                  <Chip key={slug} label={CATS[slug].label} active={activeFilter === slug} onClick={() => setActiveFilter(slug)} />
                ))}
              </div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-[var(--ink)]/60 font-medium">{searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}</p>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  aria-label="Trier les résultats"
                  className="px-4 py-2 rounded-full ring-1 ring-[var(--sand)] bg-white text-sm font-semibold text-green-deep focus:outline-none"
                >
                  <option value="recent">Les plus récents</option>
                  <option value="popular">Les plus populaires</option>
                  <option value="az">A → Z</option>
                </select>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {searchResults.map(item => <ContentCard key={item.id} item={item} onOpen={setDetailItem} />)}
              </div>
              {searchResults.length === 0 && (
                <p className="text-center text-[var(--ink)]/50 py-16">Aucun résultat trouvé. Essayez un autre mot-clé.</p>
              )}
            </div>
          </section>
        )}

        {/* ================= CATÉGORIE VIEW ================= */}
        {view === 'categorie' && (
          <section className="view active">
            <div className="pattern-geo text-white py-14">
              <div className="max-w-7xl mx-auto px-4">
                <nav className="text-sm text-white/60 mb-2">
                  <button type="button" className="cursor-pointer hover:text-gold" onClick={() => navigate('home')}>Accueil</button>
                  <span> / </span>
                  <span className="text-gold">Parcourir</span>
                </nav>
                <div className="flex items-center gap-4">
                  <span className="w-16 h-16 grid place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 text-3xl">{CATS[currentCat].icon}</span>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold">{CATS[currentCat].label}</h1>
                    <p className="text-white/70 mt-1">{catItems.length} contenu{catItems.length > 1 ? 's' : ''} disponible{catItems.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-10">
              {/* Écouter la catégorie sur le site (chaîne YouTube intégrée) */}
              <div className="pattern-geo rounded-2xl text-white p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <div className="text-center sm:text-left">
                  <h2 className="text-xl md:text-2xl font-extrabold">▶ Écouter : {CATS[currentCat].label.toLowerCase()}</h2>
                  <p className="text-white/70 text-sm mt-1">Les contenus de notre chaîne YouTube sont diffusés ici même, dans un lecteur intégré.</p>
                </div>
                <button type="button" onClick={() => openMedia(currentCat)} className="shrink-0 px-6 py-3 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition cursor-pointer">Écouter maintenant</button>
              </div>
              {/* quick category switch */}
              <div className="flex flex-wrap gap-2 mb-8">
                {ALL_CATS.map(slug => (
                  <Chip key={slug} label={`${CATS[slug].icon} ${CATS[slug].label}`} active={slug === currentCat} onClick={() => navigate('categorie', slug)} />
                ))}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {catItems.map(item => <ContentCard key={item.id} item={item} onOpen={setDetailItem} />)}
                {catItems.length === 0 && (
                  <p className="col-span-full text-center text-[var(--ink)]/50 py-16">Bientôt de nouveaux contenus dans cette catégorie.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= MÉDIAS VIEW (YouTube intégré) ================= */}
        {view === 'media' && (
          <section className="view active">
            <div className="pattern-geo text-white py-14">
              <div className="max-w-7xl mx-auto px-4">
                <nav className="text-sm text-white/60 mb-2">
                  <button type="button" className="cursor-pointer hover:text-gold" onClick={() => navigate('home')}>Accueil</button>
                  <span> / </span>
                  <span className="text-gold">Médias</span>
                </nav>
                <h1 className="text-3xl md:text-4xl font-extrabold">Écouter &amp; regarder sur le site</h1>
                <p className="text-white/75 mt-2 max-w-2xl">Prêches, cours audio, conférences, podcasts et vidéos de l'Imam Dr Bako Isaac Aboubacar — diffusés automatiquement depuis notre chaîne YouTube officielle, sans quitter la mosquée.</p>
                <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c4302b] text-white font-semibold hover:brightness-110 transition shadow-xl">
                  {YOUTUBE_ICON}
                  S'abonner à la chaîne YouTube
                </a>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-10">
              {/* Onglets : chaîne + 6 playlists */}
              <div className="flex flex-wrap gap-2 mb-8">
                {MEDIA_TABS.map(t => (
                  <Chip key={t.slug} label={`${t.icon} ${t.label}`} active={t.slug === mediaCat} onClick={() => { setMediaCat(t.slug); setAudioMode(defaultAudioMode(t.slug)); }} />
                ))}
              </div>

              {mediaLoading ? (
                <div className="grid lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Chargement des vidéos">
                  <div className="lg:col-span-2 aspect-video rounded-2xl bg-[var(--sand)]/60 animate-pulse" />
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--sand)]/60 animate-pulse" />)}
                  </div>
                </div>
              ) : mediaError ? (
                <div className="text-center py-16 px-6 rounded-3xl bg-white ring-1 ring-[var(--sand)]">
                  <span className="text-5xl" aria-hidden="true">📡</span>
                  <h3 className="mt-3 text-xl font-extrabold text-green-deep">Impossible de charger les vidéos</h3>
                  <p className="text-[var(--ink)]/60 mt-1">{mediaError}</p>
                  <button type="button" onClick={() => { delete mediaCacheRef.current[mediaCat]; setMediaReload(n => n + 1); }} className="mt-5 px-6 py-2.5 rounded-full bg-green-deep text-white font-semibold hover:bg-[var(--green)] transition cursor-pointer">Réessayer</button>
                </div>
              ) : mediaData && mediaData.videos.length > 0 ? (
                /* Vidéos disponibles — lecteur (vidéo ou audio « MP3 ») + liste latérale */
                <>
                  {/* Choix du mode de lecture : vidéo classique ou audio « MP3 » */}
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="text-sm font-semibold text-[var(--ink)]/60">Mode de lecture :</span>
                    <div className="inline-flex rounded-full ring-1 ring-[var(--sand)] bg-white p-1" role="group" aria-label="Mode de lecture">
                      <button type="button" aria-pressed={!audioMode} onClick={() => setAudioMode(false)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition cursor-pointer ${!audioMode ? 'bg-green-deep text-white' : 'text-green-deep hover:bg-[var(--cream)]'}`}>🎬 Vidéo</button>
                      <button type="button" aria-pressed={audioMode} onClick={() => setAudioMode(true)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition cursor-pointer ${audioMode ? 'bg-green-deep text-white' : 'text-green-deep hover:bg-[var(--cream)]'}`}>🎵 Audio (MP3)</button>
                    </div>
                  </div>
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      {audioMode && audioVideo ? (
                        <AudioMp3Player video={audioVideo} playTick={audioPlayTick} onEnded={playNextAudio} onFallbackToVideo={() => setAudioMode(false)} />
                      ) : (
                        <div ref={playerRef} className="rounded-2xl overflow-hidden ring-1 ring-[var(--sand)] bg-black aspect-video">
                          {playerSrc && (
                            <iframe key={playerSrc} src={playerSrc} title="Lecteur YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="w-full h-full" />
                          )}
                        </div>
                      )}
                      {currentVideo ? (
                        <div className="mt-4">
                          <h2 className="text-xl font-extrabold text-green-deep leading-snug">{currentVideo.title}</h2>
                          <p className="text-sm text-[var(--ink)]/55 mt-1">
                            {currentVideo.author}
                            {currentVideo.published ? ` · ${fmtMediaDate(currentVideo.published)}` : ''}
                            {typeof currentVideo.views === 'number' ? ` · ${fmtViews(currentVideo.views)} vues` : ''}
                          </p>
                          <a href={`https://www.youtube.com/watch?v=${currentVideo.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--green-light)] hover:underline mt-1 inline-block">Voir sur YouTube ↗</a>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--ink)]/55">Choisissez une vidéo dans la liste pour l'écouter ici même.</p>
                      )}
                    </div>

                    <aside className="bg-white rounded-2xl ring-1 ring-[var(--sand)] overflow-hidden flex flex-col">
                      <p className="px-4 py-3 border-b border-[var(--sand)] text-sm font-bold text-green-deep">
                        {mediaData.videos.length} vidéo{mediaData.videos.length > 1 ? 's' : ''} — {mediaData.label}
                      </p>
                      <div className="overflow-y-auto max-h-[420px] lg:max-h-[520px] divide-y divide-[var(--sand)]">
                        {mediaData.videos.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => { setCurrentVideo(v); if (audioMode) setAudioPlayTick(t => t + 1); playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                            aria-current={currentVideo?.id === v.id}
                            className={`w-full flex gap-3 p-3 text-left hover:bg-[var(--cream)] transition cursor-pointer ${currentVideo?.id === v.id ? 'bg-[var(--cream)]' : ''}`}
                          >
                            {audioMode ? (
                              /* Mode audio : pochette « MP3 » à la place de la miniature vidéo */
                              <span className="w-28 h-16 rounded-lg shrink-0 pattern-geo ring-1 ring-white/20 grid place-items-center" aria-hidden="true">
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-xl">🎧</span>
                                  <span className="text-[8px] font-extrabold tracking-wider text-gold">MP3</span>
                                </span>
                              </span>
                            ) : (
                              <img src={v.thumbnail} alt="" className="w-28 h-16 object-cover rounded-lg shrink-0" loading="lazy" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-green-deep line-clamp-2 leading-snug">{v.title}</span>
                              {v.published && <span className="block text-xs text-[var(--ink)]/45 mt-1">{fmtMediaDate(v.published)}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </aside>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[var(--ink)]/55">{audioMode ? 'Mode audio : le son est diffusé via le lecteur YouTube intégré.' : 'Les vidéos sont lues via le lecteur YouTube intégré.'}</p>
                    <a href={mediaData.playlistUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-green-deep hover:underline">Ouvrir sur YouTube ↗</a>
                  </div>
                </>
              ) : mediaData ? (
                /* Playlist encore vide — état d'attente élégant */
                <div className="text-center py-16 px-6 rounded-3xl bg-[var(--cream)] ring-1 ring-[var(--sand)]">
                  <span className="text-5xl" aria-hidden="true">{MEDIA_TABS.find(t => t.slug === mediaCat)?.icon ?? '🕌'}</span>
                  <h3 className="mt-3 text-xl md:text-2xl font-extrabold text-green-deep">{mediaData.label} — bientôt disponible</h3>
                  <p className="text-[var(--ink)]/65 mt-2 max-w-xl mx-auto">Les contenus de cette rubrique seront ajoutés automatiquement ici dès leur publication sur YouTube. Abonnez-vous à la chaîne pour être averti en premier.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#c4302b] text-white font-semibold hover:brightness-110 transition shadow">
                      {YOUTUBE_ICON}
                      S'abonner sur YouTube
                    </a>
                    <a href={mediaData.playlistUrl} target="_blank" rel="noreferrer" className="px-6 py-2.5 rounded-full ring-1 ring-[var(--sand)] bg-white text-green-deep font-semibold hover:bg-[var(--sand)] transition cursor-pointer">Voir la playlist</a>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* ================= ÉVÉNEMENTS VIEW ================= */}
        {view === 'evenements' && (
          <section className="view active">
            <div className="pattern-geo text-white py-14">
              <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold">Événements</h1>
                  <p className="text-white/75 mt-1">Retrouvez les prochains rendez-vous de la mosquée : cours, conférences et célébrations.</p>
                </div>
                <button
                  type="button"
                  onClick={openAdmin}
                  aria-haspopup="dialog"
                  className="px-4 py-2 rounded-full ring-1 ring-white/30 bg-white/10 hover:bg-white/20 text-sm font-semibold transition cursor-pointer"
                >
                  ⚙ Gérer les événements
                </button>
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-10">
              {/* Chargement en cours */}
              {events === null && !eventsError && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="bg-white rounded-2xl ring-1 ring-[var(--sand)] flex overflow-hidden">
                      <div className="w-24 shrink-0 bg-[var(--sand)]/60 animate-pulse" />
                      <div className="p-4 flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-[var(--sand)]/60 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-[var(--sand)]/50 rounded animate-pulse" />
                        <div className="h-3 w-2/3 bg-[var(--sand)]/50 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Erreur de chargement */}
              {events === null && eventsError && (
                <div className="bg-white rounded-2xl ring-1 ring-[var(--sand)] py-16 px-6 text-center">
                  <p className="text-5xl">⚠️</p>
                  <p className="font-bold text-green-deep mt-4 text-lg">Impossible de charger les événements</p>
                  <p className="text-[var(--ink)]/60 text-sm mt-1">Vérifiez votre connexion internet, puis réessayez.</p>
                  <button type="button" onClick={() => setEventsReload(n => n + 1)} className="mt-5 px-6 py-2.5 rounded-full bg-green-deep text-white font-semibold hover:bg-[var(--green)] transition cursor-pointer">Réessayer</button>
                </div>
              )}
              {/* Aucun événement à venir */}
              {events !== null && upcomingEvents.length === 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-[var(--sand)] py-16 px-6 text-center">
                  <p className="text-5xl">🗓️</p>
                  <p className="font-bold text-green-deep mt-4 text-lg">Aucun événement à venir pour le moment</p>
                  <p className="text-[var(--ink)]/60 text-sm mt-1">Les prochains rendez-vous apparaîtront ici dès leur publication, in sha Allah.</p>
                </div>
              )}
              {/* Grille des événements à venir */}
              {events !== null && upcomingEvents.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="pattern-geo text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Logo Mosquée Hadja Yah Diakite" className="w-12 h-12 rounded-full object-cover ring-2 ring-[var(--gold)]/40 bg-white" />
              <span className="font-extrabold text-lg">Mosquée Hadja Yah Diakite</span>
            </div>
            <p className="text-white/70 mt-4 text-sm">Un lieu de culte, d'apprentissage et de fraternité. Diffuser la science authentique avec sagesse et bienveillance.</p>
          </div>
          <div>
            <h4 className="font-bold text-gold mb-4">Parcourir</h4>
            <ul className="space-y-2 text-sm text-white/75">
              {FOOTER_CATS.map(slug => (
                <li key={slug}>
                  <button type="button" className="cursor-pointer hover:text-white" onClick={() => navigate('categorie', slug)}>{CATS[slug].label}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gold mb-4">La mosquée</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li><button type="button" className="cursor-pointer hover:text-white" onClick={() => navigate('home')}>Accueil</button></li>
              <li><button type="button" className="cursor-pointer hover:text-white" onClick={() => navigate('evenements')}>Événements</button></li>
              <li><button type="button" className="cursor-pointer hover:text-white" onClick={() => navigate('recherche')}>Recherche</button></li>
              <li><button type="button" className="cursor-pointer hover:text-white text-left" onClick={openAdmin}>⚙ Administration</button></li>
              <li><a href="/mosquee-hadja-yah-diakite.html" download="mosquee-hadja-yah-diakite.html" className="cursor-pointer hover:text-white">💾 Télécharger le site (HTML)</a></li>
              <li><button type="button" className="cursor-pointer hover:text-white" onClick={() => openMedia('chaine')}>Médias — Écouter</button></li>
              <li><button type="button" className="cursor-pointer hover:text-white text-left" onClick={() => setDonateOpen(true)}>Faire un don</button></li>
              <li>Nous contacter</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li>📍 94HF+PR6, Bingerville</li>
              <li><a href="https://wa.me/2250747008005" target="_blank" rel="noreferrer" className="hover:text-gold">💬 07 47 00 80 05 (WhatsApp)</a></li>
              <li>✉ contact@mosqueehadjayah.fr</li>
            </ul>
            <div className="flex gap-3 mt-4 flex-wrap">
              <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[var(--gold)] hover:text-[var(--green-deep)] transition cursor-pointer" title="YouTube" aria-label="YouTube">
                <BrandIcon path={YT_PATH} className="w-4 h-4" />
              </a>
              <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[var(--gold)] hover:text-[var(--green-deep)] transition cursor-pointer" title="Facebook" aria-label="Facebook">
                <BrandIcon path={FB_PATH} className="w-4 h-4" />
              </a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[var(--gold)] hover:text-[var(--green-deep)] transition cursor-pointer" title="Instagram" aria-label="Instagram">
                <BrandIcon path={IG_PATH} className="w-4 h-4" />
              </a>
              <a href={TIKTOK_URL} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[var(--gold)] hover:text-[var(--green-deep)] transition cursor-pointer" title="TikTok" aria-label="TikTok">
                <BrandIcon path={TT_PATH} className="w-4 h-4" />
              </a>
              <a href="https://wa.me/2250747008005" target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[var(--gold)] hover:text-[var(--green-deep)] transition cursor-pointer" title="WhatsApp" aria-label="WhatsApp">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/60">
          <p>© <span>{year}</span> Mosquée Hadja Yah Diakite. Tous droits réservés.</p>
          <p className="font-ar text-gold">وَقُل رَّبِّ زِدْنِي عِلْمًا</p>
        </div>
      </footer>

      {/* ============ FLOATING WHATSAPP ============ */}
      <a href="https://wa.me/2250747008005" target="_blank" rel="noreferrer" className="fixed bottom-5 left-5 z-40 flex items-center gap-2 bg-[#25D366] text-white pl-3 pr-5 py-3 rounded-full shadow-2xl hover:scale-105 transition group" title="Discuter sur WhatsApp" aria-label="Discuter sur WhatsApp">
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        <span className="font-semibold text-sm hidden sm:inline">WhatsApp</span>
      </a>

      {/* ============ DETAIL / INFO MODAL ============ */}
      {(detailItem || infoModal) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={infoModal ? infoModal.title : detailItem?.t}
          onClick={(e) => { if (e.target === e.currentTarget) { setDetailItem(null); setInfoModal(null); } }}
        >
          <div className="relative bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
            {infoModal ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-deep grid place-items-center text-3xl text-gold mb-4">✓</div>
                <h2 className="text-xl font-extrabold text-green-deep">{infoModal.title}</h2>
                <p className="text-[var(--ink)]/65 mt-2">{infoModal.msg}</p>
                <button type="button" onClick={() => setInfoModal(null)} className="mt-6 px-6 py-2.5 rounded-full bg-green-deep text-white font-semibold hover:bg-[var(--green)] transition cursor-pointer">Fermer</button>
              </div>
            ) : detailItem ? (
              <>
                {detailItem.img ? (
                  <div className="relative h-60">
                    <img src={detailItem.img} className="w-full h-full object-cover" alt={detailItem.t} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--green-deep)] to-transparent"></div>
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/90 text-green-deep">{CATS[detailItem.c].icon} {CATS[detailItem.c].label}</span>
                      {isAudioCat(detailItem.c) && <span className="px-2 py-1 rounded bg-gold text-[var(--green-deep)] text-[10px] font-extrabold tracking-wider">MP3</span>}
                    </div>
                  </div>
                ) : (
                  /* Sans photo : pochette audio décorative */
                  <div className="relative group">
                    <AudioCover icon={CATS[detailItem.c].icon} label={CATS[detailItem.c].label} dur={detailItem.dur} big noBadge />
                  </div>
                )}
                <button type="button" onClick={() => setDetailItem(null)} aria-label="Fermer" className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-white/90 text-green-deep font-bold hover:bg-white cursor-pointer">✕</button>
                <div className="p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-green-deep">{detailItem.t}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--ink)]/60">
                    <span className="flex items-center gap-1.5">👤 Imam Dr Bako Isaac Aboubacar</span>
                    <span className="flex items-center gap-1.5">🕒 {detailItem.dur}</span>
                    <span className="flex items-center gap-1.5">👁 {fmtViews(detailItem.views)} vues</span>
                    <span>{fmtDate(detailItem.date)}</span>
                  </div>
                  <p className="mt-5 text-[var(--ink)]/75 leading-relaxed">{detailItem.d}</p>
                  <p className="mt-4 text-[var(--ink)]/75 leading-relaxed">Ce contenu est proposé par l'Imam Dr Bako Isaac Aboubacar dans le cadre de l'enseignement de la Mosquée Hadja Yah Diakite. Qu'Allah récompense chacun de vos efforts dans la quête du savoir.</p>
                  <div className="flex flex-wrap gap-3 mt-7">
                    <button type="button" onClick={() => { const cat = detailItem.c; setDetailItem(null); openMedia(cat); }} className="px-6 py-3 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition cursor-pointer">▶ Écouter / Regarder</button>
                    <button type="button" onClick={() => showInfo('Ajouté aux favoris', 'Contenu sauvegardé, in sha Allah.')} className="px-6 py-3 rounded-full ring-1 ring-[var(--sand)] text-green-deep font-semibold hover:bg-[var(--cream)] transition cursor-pointer">♡ Favoris</button>
                    <button type="button" onClick={() => showInfo('Partage', 'Copiez le lien et diffusez le savoir autour de vous.')} className="px-6 py-3 rounded-full ring-1 ring-[var(--sand)] text-green-deep font-semibold hover:bg-[var(--cream)] transition cursor-pointer">↗ Partager</button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ============ MODALE DON (PayTech) ============ */}
      {donateOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donate-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeDonate(); }}
        >
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
            <button type="button" onClick={closeDonate} aria-label="Fermer" className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-[var(--cream)] text-green-deep font-bold hover:bg-[var(--sand)] transition cursor-pointer z-10">✕</button>
            <div className="p-6 md:p-8">
              <p className="font-ar text-3xl text-gold text-center">جَزَاكُمُ اللهُ خَيْرًا</p>
              <h2 id="donate-title" className="text-2xl font-extrabold text-green-deep text-center mt-1">Faire un don</h2>
              <p className="text-sm text-[var(--ink)]/65 text-center mt-2">Votre don soutient l'entretien de la mosquée, les cours et les actions caritatives. Qu'Allah vous récompense généreusement.</p>

              <form onSubmit={handleDonate} noValidate className="mt-6 space-y-5">
                {/* Montant */}
                <div>
                  <label htmlFor="don-custom" className="block text-sm font-semibold text-green-deep mb-2">Choisissez votre montant (FCFA)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESETS.map(v => (
                      <button key={v} type="button" aria-pressed={donPreset === v} onClick={() => { setDonPreset(v); setDonCustom(''); }} className={donPresetBtnClass(v)}>
                        {v.toLocaleString('fr-FR')}
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-2">
                    <input
                      id="don-custom"
                      type="number"
                      min={DON_MIN}
                      step={1}
                      inputMode="numeric"
                      value={donCustom}
                      onChange={(e) => { setDonCustom(e.target.value); setDonPreset(null); }}
                      placeholder="Montant libre"
                      className="w-full pl-5 pr-16 py-3 rounded-full ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--ink)]/50 pointer-events-none">FCFA</span>
                  </div>
                </div>

                {/* Objet du don */}
                <div>
                  <label htmlFor="don-purpose" className="block text-sm font-semibold text-green-deep mb-2">Objet du don</label>
                  <select
                    id="don-purpose"
                    value={donPurpose}
                    onChange={(e) => setDonPurpose(e.target.value as Purpose)}
                    className="w-full px-4 py-3 rounded-2xl ring-1 ring-[var(--sand)] bg-white text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                  >
                    {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                {/* Informations donateurs (optionnel) */}
                <div>
                  <p className="block text-sm font-semibold text-green-deep mb-2">Vos informations (optionnel)</p>
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="don-name" className="block text-xs font-semibold text-[var(--ink)]/60 mb-1">Nom complet</label>
                      <input id="don-name" type="text" value={donName} onChange={(e) => setDonName(e.target.value)} placeholder="Votre nom complet" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                    </div>
                    <div>
                      <label htmlFor="don-email" className="block text-xs font-semibold text-[var(--ink)]/60 mb-1">E-mail</label>
                      <input id="don-email" type="email" value={donEmail} onChange={(e) => setDonEmail(e.target.value)} placeholder="vous@exemple.com" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                    </div>
                    <div>
                      <label htmlFor="don-phone" className="block text-xs font-semibold text-[var(--ink)]/60 mb-1">Téléphone</label>
                      <input id="don-phone" type="tel" value={donPhone} onChange={(e) => setDonPhone(e.target.value)} placeholder="07 47 00 80 05" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={donLoading} className="w-full py-3.5 rounded-full bg-green-deep text-white font-bold hover:bg-[var(--green)] transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                  {donLoading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Connexion à PayTech…
                    </span>
                  ) : (
                    'Poursuivre le paiement →'
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-[var(--ink)]/60 mt-4">🔒 Paiement 100% sécurisé via PayTech</p>
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {PAY_METHODS.map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-full bg-[var(--cream)] ring-1 ring-[var(--sand)] text-[11px] font-semibold text-green-deep">{m}</span>
                ))}
              </div>

              {donError && <p className="mt-4 text-sm font-semibold text-red-600 text-center" role="alert">{donError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ============ MODALE RÉSULTAT PAIEMENT ============ */}
      {paymentResult && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-result-title"
          onClick={(e) => { if (e.target === e.currentTarget) setPaymentResult(null); }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-8 text-center">
            {paymentResult === 'success' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-green-deep grid place-items-center text-3xl text-gold mb-4">✓</div>
                <p className="font-ar text-2xl text-gold">شُكْرًا وَبَارَكَ اللهُ فِيكُمْ</p>
                <h2 id="payment-result-title" className="text-xl font-extrabold text-green-deep mt-2">Don reçu, barakAllahu fik !</h2>
                <p className="text-[var(--ink)]/65 mt-2">Votre don a bien été enregistré. Qu'Allah le multiplie en récompenses et facilite vos entreprises.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-[var(--sand)] grid place-items-center text-3xl text-green-deep mb-4">✕</div>
                <h2 id="payment-result-title" className="text-xl font-extrabold text-green-deep">Paiement annulé</h2>
                <p className="text-[var(--ink)]/65 mt-2">Votre paiement a été annulé. Vous pouvez réessayer quand vous le souhaitez.</p>
              </>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {paymentResult === 'cancel' && (
                <button type="button" onClick={() => { setPaymentResult(null); setDonateOpen(true); }} className="px-6 py-2.5 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition cursor-pointer">Réessayer</button>
              )}
              <button type="button" onClick={() => setPaymentResult(null)} className="px-6 py-2.5 rounded-full bg-green-deep text-white font-semibold hover:bg-[var(--green)] transition cursor-pointer">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODALE ADMIN ÉVÉNEMENTS ============ */}
      {adminOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeAdmin(); }}
        >
          <div className="relative bg-white rounded-3xl max-w-lg w-full shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide">
            <button type="button" onClick={closeAdmin} aria-label="Fermer" className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-[var(--cream)] text-green-deep font-bold hover:bg-[var(--sand)] transition cursor-pointer z-10">✕</button>
            <div className="p-6 md:p-8">
              {!adminAuthed ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-deep grid place-items-center text-3xl text-gold mb-4">⚙</div>
                  <h2 id="admin-title" className="text-2xl font-extrabold text-green-deep text-center">Gérer les événements</h2>
                  <p className="text-sm text-[var(--ink)]/65 text-center mt-2">Espace réservé à l'administration de la mosquée : ajoutez, modifiez ou supprimez les événements affichés sur le site.</p>
                  <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
                    <div>
                      <label htmlFor="admin-pwd" className="block text-sm font-semibold text-green-deep mb-2">Mot de passe administrateur</label>
                      <input
                        id="admin-pwd"
                        type="password"
                        autoComplete="current-password"
                        value={adminPwd}
                        onChange={(e) => setAdminPwd(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                      />
                    </div>
                    {adminError && <p className="text-sm font-semibold text-red-600" role="alert">{adminError}</p>}
                    <button type="submit" disabled={adminLoading || adminPwd.length === 0} className="w-full py-3 rounded-full bg-green-deep text-white font-bold hover:bg-[var(--green)] transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                      {adminLoading ? 'Vérification…' : 'Se connecter'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {/* Onglets : événements / audios hébergés */}
                  <div role="tablist" aria-label="Sections d'administration" className="flex gap-2 mb-5">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adminSection === 'events'}
                      onClick={() => setAdminSection('events')}
                      className={`flex-1 px-3 py-2.5 rounded-full text-sm font-bold transition cursor-pointer ring-1 ${adminSection === 'events' ? 'bg-green-deep text-white ring-[var(--green-deep)]' : 'bg-white text-green-deep ring-[var(--sand)] hover:bg-[var(--cream)]'}`}
                    >
                      📅 Événements
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adminSection === 'audios'}
                      onClick={() => { setAdminSection('audios'); setConfirmDelAudioId(null); void refreshAudios(); }}
                      className={`flex-1 px-3 py-2.5 rounded-full text-sm font-bold transition cursor-pointer ring-1 ${adminSection === 'audios' ? 'bg-green-deep text-white ring-[var(--green-deep)]' : 'bg-white text-green-deep ring-[var(--sand)] hover:bg-[var(--cream)]'}`}
                    >
                      🎙 Audios
                    </button>
                  </div>

                  {/* Mise en ligne : kit + guide pour déployer le site sur un serveur gratuit */}
                  <div className="mb-5 rounded-2xl ring-1 ring-[var(--sand)] bg-[var(--cream)] p-3.5">
                    <p className="text-xs font-bold text-green-deep">🚀 Mise en ligne sur un serveur gratuit (Vercel)</p>
                    <p className="text-xs text-[var(--ink)]/60 mt-0.5 leading-relaxed">Téléchargez le kit du site, puis suivez le guide illustré pas-à-pas (3 comptes gratuits : GitHub, Neon, Vercel).</p>
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <a href="/mosquee-site-source.zip" download className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-green-deep text-white text-xs font-bold hover:bg-[var(--green)] transition cursor-pointer">⬇️ Kit du site (.zip)</a>
                      <a href="/guide-deploiement.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full ring-1 ring-[var(--sand)] bg-white text-green-deep text-xs font-bold hover:bg-[var(--cream)] transition cursor-pointer">📖 Guide pas-à-pas</a>
                    </div>
                  </div>

                  {adminSection === 'events' ? (
                    editingEvent !== null ? (
                <form onSubmit={handleEventSubmit} noValidate className="mt-1 space-y-4">
                  <h2 id="admin-title" className="text-2xl font-extrabold text-green-deep">{editingEvent === 'new' ? 'Nouvel événement' : "Modifier l'événement"}</h2>
                  <div>
                    <label htmlFor="ev-title" className="block text-sm font-semibold text-green-deep mb-2">Titre de l'événement <span className="text-red-500">*</span></label>
                    <input id="ev-title" type="text" maxLength={150} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Ex. Conférence : La famille en Islam" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ev-date" className="block text-sm font-semibold text-green-deep mb-2">Date <span className="text-red-500">*</span></label>
                      <input id="ev-date" type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                    </div>
                    <div>
                      <label htmlFor="ev-time" className="block text-sm font-semibold text-green-deep mb-2">Heure</label>
                      <input id="ev-time" type="time" value={evTime} onChange={(e) => setEvTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ev-place" className="block text-sm font-semibold text-green-deep mb-2">Lieu</label>
                    <input id="ev-place" type="text" maxLength={200} value={evPlace} onChange={(e) => setEvPlace(e.target.value)} placeholder="Ex. Salle principale" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                  </div>
                  {/* Image : recommandée par le site ou hébergée par l'administration */}
                  <div>
                    <span className="block text-sm font-semibold text-green-deep mb-2">Image de l&apos;événement (optionnel)</span>
                    {evImage && (
                      <div className="relative mb-3 rounded-xl overflow-hidden ring-1 ring-[var(--sand)]">
                        <img src={evImage} alt="Aperçu de l'image de l'événement" className="w-full h-36 object-cover" />
                        <button type="button" onClick={() => setEvImage('')} aria-label="Retirer l'image" className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-white/90 text-green-deep font-bold hover:bg-white transition cursor-pointer shadow">✕</button>
                      </div>
                    )}
                    <p className="text-xs text-[var(--ink)]/55 mb-2">Images recommandées par le site :</p>
                    <div className="grid grid-cols-3 gap-2">
                      {RECOMMENDED_IMAGES.map(url => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setEvImage(url)}
                          aria-pressed={evImage === url}
                          aria-label="Utiliser cette image recommandée"
                          className={`relative rounded-lg overflow-hidden ring-2 transition cursor-pointer ${evImage === url ? 'ring-[var(--gold)]' : 'ring-transparent hover:ring-[var(--sand)]'}`}
                        >
                          <img src={url} alt="" className="w-full h-16 object-cover" loading="lazy" />
                          {evImage === url && <span className="absolute inset-0 bg-[var(--green-deep)]/45 grid place-items-center text-white text-lg font-bold">✓</span>}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--ink)]/55 mt-3 mb-1.5">Ou hébergez votre propre image (JPG, PNG ou WEBP — 5 Mo maximum) :</p>
                    <label
                      htmlFor="ev-image-file"
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full ring-1 ring-[var(--sand)] bg-white text-sm font-semibold text-green-deep hover:bg-[var(--cream)] transition ${evUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                    >
                      📁 Choisir un fichier…
                    </label>
                    <input
                      id="ev-image-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={evUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImageUpload(f); }}
                    />
                    {evUploading && <p className="mt-2 text-xs font-semibold text-[var(--green-light)]" role="status">Hébergement de l&apos;image en cours…</p>}
                    {evImgError && <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{evImgError}</p>}
                  </div>
                  {evError && <p className="text-sm font-semibold text-red-600" role="alert">{evError}</p>}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button type="submit" disabled={evSaving} className="flex-1 py-3 rounded-full bg-green-deep text-white font-bold hover:bg-[var(--green)] transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                      {evSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                    <button type="button" onClick={cancelEditEvent} className="px-6 py-3 rounded-full ring-1 ring-[var(--sand)] text-green-deep font-semibold hover:bg-[var(--cream)] transition cursor-pointer">Annuler</button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 id="admin-title" className="text-2xl font-extrabold text-green-deep">Mes événements</h2>
                  <p className="text-sm text-[var(--ink)]/60 mt-1">{adminList.length} événement(s) enregistré(s). Les événements passés ne s'affichent plus sur le site.</p>
                  {adminMsg && <p className="mt-3 text-sm font-semibold text-green-deep bg-[var(--cream)] ring-1 ring-[var(--sand)] rounded-xl px-4 py-2.5" role="status">{adminMsg}</p>}
                  {adminError && <p className="mt-3 text-sm font-semibold text-red-600" role="alert">{adminError}</p>}
                  <button type="button" onClick={startNewEvent} className="mt-4 w-full py-3 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition cursor-pointer">+ Ajouter un événement</button>
                  <div className="mt-4 max-h-80 overflow-y-auto ring-1 ring-[var(--sand)] rounded-2xl scrollbar-hide">
                    {adminList.length === 0 ? (
                      <p className="p-6 text-center text-sm text-[var(--ink)]/60">Aucun événement enregistré pour le moment.</p>
                    ) : (
                      adminList.map(ev => (
                        <div key={ev.id} className="p-4 border-t border-[var(--sand)] first:border-t-0 flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 flex gap-3">
                            {ev.imageUrl && <img src={ev.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 ring-1 ring-[var(--sand)]" loading="lazy" />}
                            <div className="min-w-0">
                              <p className="font-bold text-green-deep leading-snug break-words">{ev.title}</p>
                              <p className="text-xs text-[var(--ink)]/55 mt-1">
                                {fmtDate(ev.date)}{ev.time ? ` · ${ev.time}` : ''}{ev.place ? ` · ${ev.place}` : ''}
                                {isPastEvent(ev.date) && <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--sand)] text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/70 align-middle">Passé</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => startEditEvent(ev)} className="px-3 py-1.5 rounded-full ring-1 ring-[var(--sand)] text-xs font-semibold text-green-deep hover:bg-[var(--cream)] transition cursor-pointer">Modifier</button>
                            {confirmDelId === ev.id ? (
                              <>
                                <button type="button" onClick={() => handleDeleteEvent(ev.id)} disabled={adminBusy} className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer disabled:opacity-70">Confirmer</button>
                                <button type="button" onClick={() => setConfirmDelId(null)} className="px-3 py-1.5 rounded-full ring-1 ring-[var(--sand)] text-xs font-semibold text-[var(--ink)]/60 hover:bg-[var(--cream)] transition cursor-pointer">Annuler</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setConfirmDelId(ev.id)} className="px-3 py-1.5 rounded-full ring-1 ring-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer">Supprimer</button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button type="button" onClick={handleAdminLogout} className="mt-5 mx-auto block text-xs text-[var(--ink)]/50 hover:text-green-deep underline cursor-pointer">Se déconnecter</button>
                      </>
                    )
                  ) : (
                    <>
                      <h2 id="admin-title" className="text-2xl font-extrabold text-green-deep">Audios de l&apos;Imam</h2>
                      <p className="text-sm text-[var(--ink)]/60 mt-1">Hébergez un fichier audio (MP3, M4A, AAC, OGG ou WAV — 25 Mo maximum) : il sera publié en tête de la section « Les nouveautés », avec un lecteur d&apos;écoute.</p>
                      {audioMsg && <p className="mt-3 text-sm font-semibold text-green-deep bg-[var(--cream)] ring-1 ring-[var(--sand)] rounded-xl px-4 py-2.5" role="status">{audioMsg}</p>}
                      <form onSubmit={handleAudioPublish} noValidate className="mt-4 space-y-4 ring-1 ring-[var(--sand)] rounded-2xl p-4">
                        <p className="text-sm font-bold text-green-deep">+ Nouvel audio</p>
                        <div>
                          <label htmlFor="au-title" className="block text-sm font-semibold text-green-deep mb-2">Titre <span className="text-red-500">*</span></label>
                          <input id="au-title" type="text" maxLength={150} value={auTitle} onChange={(e) => setAuTitle(e.target.value)} placeholder="Ex. Rappel : la patience du croyant" className="w-full px-4 py-2.5 rounded-xl ring-1 ring-[var(--sand)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" />
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-green-deep mb-2">Fichier audio <span className="text-red-500">*</span></span>
                          {auFileUrl ? (
                            <div className="rounded-xl ring-1 ring-[var(--sand)] p-3 bg-[var(--cream)]">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-green-deep break-all min-w-0">✓ Fichier hébergé{auFileName ? ` — ${auFileName}` : ''}</p>
                                <button type="button" onClick={() => { setAuFileUrl(''); setAuFileName(''); }} className="shrink-0 text-xs font-semibold text-red-600 hover:underline cursor-pointer">Retirer</button>
                              </div>
                              <audio controls preload="metadata" src={auFileUrl} className="w-full mt-2" aria-label="Aperçu du fichier hébergé"></audio>
                            </div>
                          ) : (
                            <>
                              <label
                                htmlFor="au-file"
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full ring-1 ring-[var(--sand)] bg-white text-sm font-semibold text-green-deep hover:bg-[var(--cream)] transition ${auUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                              >
                                📁 Choisir un fichier audio…
                              </label>
                              <input
                                id="au-file"
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/x-wav,.mp3,.m4a,.aac,.ogg,.wav"
                                className="sr-only"
                                disabled={auUploading}
                                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleAudioUpload(f); }}
                              />
                              <p className="text-xs text-[var(--ink)]/55 mt-1.5">Le fichier est hébergé directement sur le site, aucun service externe.</p>
                            </>
                          )}
                          {auUploading && <p className="mt-2 text-xs font-semibold text-[var(--green-light)]" role="status">Hébergement du fichier en cours…</p>}
                        </div>
                        {auError && <p className="text-sm font-semibold text-red-600" role="alert">{auError}</p>}
                        <button type="submit" disabled={auSaving || auUploading || auFileUrl.length === 0 || auTitle.trim().length === 0} className="w-full py-3 rounded-full bg-gold text-[var(--green-deep)] font-bold hover:bg-[var(--gold-light)] transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                          {auSaving ? 'Publication…' : "Publier l'audio"}
                        </button>
                      </form>
                      <p className="text-sm font-bold text-green-deep mt-5 mb-2">Audios publiés ({adminAudioList.length})</p>
                      <div className="max-h-64 overflow-y-auto ring-1 ring-[var(--sand)] rounded-2xl scrollbar-hide">
                        {adminAudioList.length === 0 ? (
                          <p className="p-6 text-center text-sm text-[var(--ink)]/60">Aucun audio publié pour le moment.</p>
                        ) : (
                          adminAudioList.map(a => (
                            <div key={a.id} className="p-3.5 border-t border-[var(--sand)] first:border-t-0">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="font-bold text-green-deep leading-snug break-words min-w-0 flex-1">{a.title}</p>
                                {confirmDelAudioId === a.id ? (
                                  <div className="flex gap-2 shrink-0">
                                    <button type="button" onClick={() => handleDeleteAudio(a.id)} disabled={adminBusy} className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer disabled:opacity-70">Confirmer</button>
                                    <button type="button" onClick={() => setConfirmDelAudioId(null)} className="px-3 py-1.5 rounded-full ring-1 ring-[var(--sand)] text-xs font-semibold text-[var(--ink)]/60 hover:bg-[var(--cream)] transition cursor-pointer">Annuler</button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => setConfirmDelAudioId(a.id)} className="px-3 py-1.5 rounded-full ring-1 ring-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer">Supprimer</button>
                                )}
                              </div>
                              <audio controls preload="none" src={a.audioUrl} className="w-full mt-2" aria-label={`Écouter : ${a.title}`}></audio>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
