"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Volume2, ArrowLeft, Pause, Square, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";

interface Surah {
  nomor: number;
  nama: string;
  nama_latin: string;
  jumlah_ayat: number;
  tempat_turun: string;
  arti: string;
  deskripsi: string;
  audio: string;
}

interface Ayat {
  id: number;
  surah: number;
  nomor: number;
  ar: string;
  tr: string;
  idn: string;
}

interface SurahWithAyahs {
  surah: Surah;
  ayahs: Ayat[];
}

interface AudioState {
  url: string | null;
  isPlaying: boolean;
  isPaused: boolean;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahsWithAyahs, setSurahsWithAyahs] = useState<Record<number, Ayat[]>>({});
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [searchResults, setSearchResults] = useState<SurahWithAyahs[]>([]);
  const [isSearching, setIsSearching] = useState(!!searchParams.get("q"));
  const [totalSearchMatches, setTotalSearchMatches] = useState(0);
  const [audioState, setAudioState] = useState<AudioState>({
    url: null,
    isPlaying: false,
    isPaused: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const fetchSurahs = async () => {
    try {
      const response = await fetch("https://quran-api.santrikoding.com/api/surah");
      const data = await response.json();
      setSurahs(data);
      setLoading(false);

      const surahNumber = searchParams.get("surah");
      if (surahNumber) {
        fetchSurahDetail(parseInt(surahNumber, 10));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch surah list",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurahs();
  }, []);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setSearchTerm(query);
      handleSearch(query);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fetchSurahDetail = async (number: number) => {
    try {
      setLoading(true);
      const response = await fetch(`https://quran-api.santrikoding.com/api/surah/${number}`);
      const data = await response.json();
      setSelectedSurah(data);
      setAyahs(data.ayat);
      
      setSurahsWithAyahs(prev => ({
        ...prev,
        [number]: data.ayat
      }));
      
      setLoading(false);
      setIsSearching(false);
      
      router.push(`?surah=${number}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch surah detail",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSearch = async (searchQuery = searchTerm) => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      router.push("/");
      return;
    }
    
    setIsSearching(true);
    setLoading(true);
    setSelectedSurah(null);
    
    try {
      const results: SurahWithAyahs[] = [];
      let totalMatches = 0;
      const searchTermLower = searchQuery.toLowerCase();
      
      await Promise.all(surahs.map(async (surah) => {
        let surahAyahs = surahsWithAyahs[surah.nomor];
        
        if (!surahAyahs) {
          const response = await fetch(`https://quran-api.santrikoding.com/api/surah/${surah.nomor}`);
          const data = await response.json();
          surahAyahs = data.ayat;
          setSurahsWithAyahs(prev => ({
            ...prev,
            [surah.nomor]: surahAyahs
          }));
        }
        
        const matchingAyahs = surahAyahs.filter((ayah: Ayat) => 
          ayah.idn.toLowerCase().includes(searchTermLower)
        );
        
        if (matchingAyahs.length > 0) {
          results.push({
            surah,
            ayahs: matchingAyahs,
          });
          totalMatches += matchingAyahs.length;
        }
      }));
      
      setSearchResults(results);
      setTotalSearchMatches(totalMatches);
      setLoading(false);

      router.push(`?q=${encodeURIComponent(searchQuery)}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const playAudio = (audioUrl: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (audioRef.current && audioState.url !== audioUrl) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioState.url === audioUrl && audioState.isPaused && audioRef.current) {
      audioRef.current.play();
      setAudioState({
        url: audioUrl,
        isPlaying: true,
        isPaused: false,
      });
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('ended', () => {
        setAudioState({
          url: audioUrl,
          isPlaying: false,
          isPaused: false,
        });
      });
    }

    audioRef.current.play().catch(error => {
      toast({
        title: "Error",
        description: "Failed to play audio",
        variant: "destructive",
      });
    });

    setAudioState({
      url: audioUrl,
      isPlaying: true,
      isPaused: false,
    });
  };

  const pauseAudio = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: true,
      }));
    }
  };

  const stopAudio = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setAudioState({
        url: null,
        isPlaying: false,
        isPaused: false,
      });
    }
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const handleBack = () => {
    setSelectedSurah(null);
    setIsSearching(false);
    setSearchTerm("");
    setSearchResults([]);
    setTotalSearchMatches(0);
    if (audioRef.current) {
      stopAudio();
    }
    router.push("/");
  };

  const cleanHtmlTags = (text: string) => {
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');
    return text.trim();
  };

  const formatDescription = (description: string) => {
    return description.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-2 text-justify leading-relaxed">
        {paragraph.trim()}
      </p>
    ));
  };

  const renderAudioControls = (audioUrl: string, e?: React.MouseEvent) => (
    <div className="flex gap-2">
      {(!audioState.isPlaying && (!audioState.isPaused || audioState.url !== audioUrl)) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => playAudio(audioUrl, e)}
        >
          <Play className="w-4 h-4" />
        </Button>
      )}
      {audioState.isPlaying && audioState.url === audioUrl && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => pauseAudio(e)}
        >
          <Pause className="w-4 h-4" />
        </Button>
      )}
      {audioState.isPaused && audioState.url === audioUrl && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => playAudio(audioUrl, e)}
        >
          <Play className="w-4 h-4" />
        </Button>
      )}
      {(audioState.isPlaying || audioState.isPaused) && audioState.url === audioUrl && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => stopAudio(e)}
        >
          <Square className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold text-center">Al-Quran Search</h1>
          <div className="flex gap-2">
            <Input
              placeholder="Search in Al-Quran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={() => handleSearch()}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {(selectedSurah || isSearching) && (
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="ghost"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to List
            </Button>
            {isSearching && (
              <p className="text-sm text-muted-foreground">
                Found {totalSearchMatches} matches
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : isSearching ? (
          <div className="space-y-6">
            {searchResults.length === 0 ? (
              <p className="text-center text-muted-foreground">No results found for "{searchTerm}"</p>
            ) : (
              searchResults.map((result, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <div className="bg-muted p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-semibold">
                          {result.surah.nama_latin}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {result.surah.arti}
                        </p>
                      </div>
                      {renderAudioControls(result.surah.audio)}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {result.ayahs.map((ayah: Ayat) => (
                      <div key={ayah.nomor} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Ayat {ayah.nomor}</span>
                        </div>
                        <p className="text-right text-xl leading-relaxed">{ayah.ar}</p>
                        <p className="text-sm italic text-muted-foreground">
                          {cleanHtmlTags(ayah.tr)}
                        </p>
                        <p 
                          className="text-foreground"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightSearchTerm(ayah.idn)
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : selectedSurah ? (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="bg-muted p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedSurah.nama_latin}</h2>
                    <p className="text-lg">{selectedSurah.nama}</p>
                    <p className="text-muted-foreground">
                      {selectedSurah.arti} • {selectedSurah.tempat_turun} • {selectedSurah.jumlah_ayat} Ayat
                    </p>
                  </div>
                  {renderAudioControls(selectedSurah.audio)}
                </div>
                <div className="prose prose-sm max-w-none text-foreground">
                  {formatDescription(cleanHtmlTags(selectedSurah.deskripsi))}
                </div>
              </div>
            </Card>
            
            <div className="space-y-4">
              {ayahs.map((ayah) => (
                <Card key={ayah.nomor} className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Ayat {ayah.nomor}</span>
                  </div>
                  <p className="text-right text-2xl leading-relaxed">{ayah.ar}</p>
                  <p className="text-sm italic text-muted-foreground">
                    {cleanHtmlTags(ayah.tr)}
                  </p>
                  <p className="text-foreground">{ayah.idn}</p>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {surahs.map((surah) => (
              <Card
                key={surah.nomor}
                className="overflow-hidden hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => fetchSurahDetail(surah.nomor)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">
                      {surah.nomor}. {surah.nama_latin}
                    </h3>
                    {renderAudioControls(surah.audio)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{surah.arti}</p>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{surah.tempat_turun}</span>
                    <span>{surah.jumlah_ayat} Ayat</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}