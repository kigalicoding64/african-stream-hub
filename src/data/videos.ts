import heroMusic from "@/assets/hero-music.jpg";
import thumbComedy from "@/assets/thumb-comedy.jpg";
import thumbFilm from "@/assets/thumb-film.jpg";
import thumbFilm2 from "@/assets/thumb-film2.jpg";
import thumbMusic1 from "@/assets/thumb-music1.jpg";
import thumbMusic2 from "@/assets/thumb-music2.jpg";
import thumbAga from "@/assets/thumb-agasobanuye.jpg";
import thumbTrend from "@/assets/thumb-trending1.jpg";

export type Category = "Music" | "Comedy" | "Films" | "Agasobanuye";
export type Language = "Kinyarwanda" | "Swahili" | "English";

export interface Video {
  id: string;
  title: string;
  creator: string;
  creatorAvatar?: string;
  thumbnail: string;
  previewSrc?: string; // muted mp4 preview
  views: string;
  duration: string;
  language: Language;
  category: Category;
  description: string;
  uploadedAt: string;
}

// Royalty-free preview clip (small, public test)
const SAMPLE_PREVIEW = "https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4";

export const videos: Video[] = [
  {
    id: "v1",
    title: "Kigali Nights — Live from the Rooftop",
    creator: "Bruce Melodie",
    thumbnail: heroMusic,
    previewSrc: SAMPLE_PREVIEW,
    views: "2.4M",
    duration: "4:12",
    language: "Kinyarwanda",
    category: "Music",
    description: "An exclusive live performance from the heart of Kigali, blending afrobeats with traditional Rwandan rhythms.",
    uploadedAt: "3 days ago",
  },
  {
    id: "v2",
    title: "Agasobanuye: The Lion King — Episode 1",
    creator: "Junior Giti",
    thumbnail: thumbAga,
    previewSrc: SAMPLE_PREVIEW,
    views: "1.1M",
    duration: "12:48",
    language: "Kinyarwanda",
    category: "Agasobanuye",
    description: "The legendary storyteller returns with a fresh take on a classic.",
    uploadedAt: "1 week ago",
  },
  {
    id: "v3",
    title: "Two Idiots in Town — Comedy Special",
    creator: "City Maid",
    thumbnail: thumbComedy,
    previewSrc: SAMPLE_PREVIEW,
    views: "890K",
    duration: "8:21",
    language: "Kinyarwanda",
    category: "Comedy",
    description: "Laugh-out-loud sketches from Kigali's funniest duo.",
    uploadedAt: "2 days ago",
  },
  {
    id: "v4",
    title: "Imana y'i Rwanda — Short Film",
    creator: "Kivu Films",
    thumbnail: thumbFilm,
    previewSrc: SAMPLE_PREVIEW,
    views: "540K",
    duration: "21:05",
    language: "Kinyarwanda",
    category: "Films",
    description: "An award-winning short film exploring identity and belonging.",
    uploadedAt: "5 days ago",
  },
  {
    id: "v5",
    title: "Afrobeats Carnival — Music Video",
    creator: "The Ben",
    thumbnail: thumbMusic1,
    previewSrc: SAMPLE_PREVIEW,
    views: "3.7M",
    duration: "3:48",
    language: "English",
    category: "Music",
    description: "Neon-lit, high-energy afrobeats anthem.",
    uploadedAt: "1 day ago",
  },
  {
    id: "v6",
    title: "Intore — Traditional Dance Live",
    creator: "Inganzo Ngari",
    thumbnail: thumbMusic2,
    previewSrc: SAMPLE_PREVIEW,
    views: "1.8M",
    duration: "6:30",
    language: "Kinyarwanda",
    category: "Music",
    description: "Centuries-old Rwandan dance reimagined for the stage.",
    uploadedAt: "4 days ago",
  },
  {
    id: "v7",
    title: "Kigali by Drone — Cinematic 4K",
    creator: "Visit Rwanda",
    thumbnail: thumbTrend,
    previewSrc: SAMPLE_PREVIEW,
    views: "920K",
    duration: "5:14",
    language: "English",
    category: "Films",
    description: "Soar over the City of a Thousand Hills.",
    uploadedAt: "6 days ago",
  },
  {
    id: "v8",
    title: "Boda Boda Diaries — Episode 4",
    creator: "Mtaa Stories",
    thumbnail: thumbFilm2,
    previewSrc: SAMPLE_PREVIEW,
    views: "410K",
    duration: "14:22",
    language: "Swahili",
    category: "Films",
    description: "A gripping urban drama from the streets of East Africa.",
    uploadedAt: "1 week ago",
  },
];

export const getVideoById = (id: string) => videos.find((v) => v.id === id);
export const getTrending = () => videos.slice().sort((a, b) => parseFloat(b.views) - parseFloat(a.views));
