import { Map3D } from "../components/map/Map3D";

export function MapPage() {
  return (
    <div className="fixed inset-0 top-16.25 sm:top-18.25 z-0 bg-slate-900 animate-in fade-in duration-500">
      <Map3D />
    </div>
  );
}
