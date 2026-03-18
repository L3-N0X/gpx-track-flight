import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Mountain, Map as MapIcon, Loader2 } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const text = await file.text();
      navigate('/map', { state: { gpxContent: text } });
    } catch (err) {
      console.error("Failed to read file", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 min-h-[80vh] w-full max-w-5xl mx-auto px-4 text-center animate-in fade-in duration-700">
      <div className="bg-primary/10 p-5 rounded-full mb-8">
        <Mountain className="w-14 h-14 text-primary" />
      </div>
      
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
        Relive Your <span className="text-primary">Adventures</span> in 3D
      </h1>
      
      <p className="text-xl text-muted-foreground mb-14 max-w-2xl mx-auto leading-relaxed">
        Upload your GPX tracks from your bike trips or hikes and visualize them on an interactive, realistic 3D mountain map.
      </p>

      <div 
        className={`relative w-full max-w-xl border-2 border-dashed rounded-3xl p-14 transition-all duration-300 ${isHovering ? "border-primary bg-primary/5 scale-[1.02] shadow-xl shadow-primary/10" : "border-border/60 bg-card/30 hover:border-primary/50"} cursor-pointer group`}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={(e) => { 
          e.preventDefault(); 
          setIsHovering(false); 
          handleFileChange(e.dataTransfer.files[0]); 
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          accept=".gpx" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
        
        <div className="flex flex-col items-center justify-center">
          {isLoading ? (
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
          ) : (
            <div className="bg-primary/10 p-5 rounded-full mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
              <UploadCloud className="w-10 h-10 text-primary" />
            </div>
          )}
          <h3 className="text-2xl font-semibold mb-3">
            {isLoading ? "Processing Track..." : "Upload GPX File"}
          </h3>
          <p className="text-muted-foreground text-lg">
            Drag and drop your track here, or click to browse
          </p>
        </div>
      </div>
      
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
        <div className="bg-card/40 hover:bg-card/60 transition-colors p-8 rounded-2xl border border-border/50">
          <MapIcon className="w-10 h-10 text-primary mb-5" />
          <h3 className="text-xl font-semibold mb-3">Realistic 3D Terrain</h3>
          <p className="text-muted-foreground">Experience your tracks on actual topographic maps with detailed elevation data and satellite imagery.</p>
        </div>
        <div className="bg-card/40 hover:bg-card/60 transition-colors p-8 rounded-2xl border border-border/50">
          <Mountain className="w-10 h-10 text-primary mb-5" />
          <h3 className="text-xl font-semibold mb-3">Immersive Flight</h3>
          <p className="text-muted-foreground">Fly over your route with free-cam controls and relive every curve and climb of your journey.</p>
        </div>
        <div className="bg-card/40 hover:bg-card/60 transition-colors p-8 rounded-2xl border border-border/50">
          <UploadCloud className="w-10 h-10 text-primary mb-5" />
          <h3 className="text-xl font-semibold mb-3">Instant Visualization</h3>
          <p className="text-muted-foreground">No servers, no waiting. We parse and render the GPX file instantly right in your browser.</p>
        </div>
      </div>
    </div>
  );
}
