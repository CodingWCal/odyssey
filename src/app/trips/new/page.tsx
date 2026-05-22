import { TripForm } from "@/components/trips/TripForm";

export default function NewTripPage() {
  return (
    <div className="min-h-screen bg-odyssey-mist flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-odyssey-cream p-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-odyssey-ink">New Trip</h1>
          <p className="text-odyssey-slate text-sm mt-1">Where are we going?</p>
        </div>
        <TripForm />
      </div>
    </div>
  );
}
