"use client";

import { Icons } from "@/components/shared/Icons";
import { LocationAutocomplete } from "./LocationAutocomplete";

/** Form-shaped leg (lat/lng as `undefined`, matching the rest of this form's
 * own lat/lng state) — normalized to FlightLeg's `null` shape on save. */
export interface LegFormState {
  flightNumber: string;
  from: string;
  fromLat: number | undefined;
  fromLng: number | undefined;
  to: string;
  toLat: number | undefined;
  toLng: number | undefined;
  departTime: string;
  arriveTime: string;
  operatedBy: string;
}

export function emptyLeg(): LegFormState {
  return {
    flightNumber: "",
    from: "",
    fromLat: undefined,
    fromLng: undefined,
    to: "",
    toLat: undefined,
    toLng: undefined,
    departTime: "",
    arriveTime: "",
    operatedBy: "",
  };
}

interface FlightLegsFieldsProps {
  legs: LegFormState[];
  destination?: string;
  onChange: (legs: LegFormState[]) => void;
}

/**
 * Repeating from/to/depart/arrive/flight-number sub-form for a multi-leg
 * flight (ODY-144) — "Add another leg" appends a blank leg; each leg past
 * the first gets a remove button. Layover is never entered manually — it's
 * auto-computed between consecutive legs' times for display, see
 * lib/flightLegs.ts.
 */
export function FlightLegsFields({ legs, destination, onChange }: FlightLegsFieldsProps) {
  function updateLeg(i: number, patch: Partial<LegFormState>) {
    onChange(legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLeg(i: number) {
    onChange(legs.filter((_, idx) => idx !== i));
  }
  function addLeg() {
    onChange([...legs, emptyLeg()]);
  }

  return (
    <div className="flight-legs-form">
      {legs.map((leg, i) => (
        <div className="flight-leg-form" key={i}>
          <div className="flight-leg-form-head">
            <span className="flight-leg-form-num">Leg {i + 1}</span>
            {legs.length > 1 && (
              <button
                type="button"
                className="icon-btn sm danger"
                onClick={() => removeLeg(i)}
                aria-label={`Remove leg ${i + 1}`}
                title="Remove leg"
              >
                <Icons.trash size={13} />
              </button>
            )}
          </div>

          <div className="field">
            <label htmlFor={`leg-${i}-from`}>From (departure)</label>
            <LocationAutocomplete
              id={`leg-${i}-from`}
              value={leg.from}
              placeholder="John F. Kennedy International Airport"
              near={destination}
              onChange={(text) => updateLeg(i, { from: text })}
              onPick={(s) => updateLeg(i, { from: s.display, fromLat: s.lat, fromLng: s.lng })}
            />
          </div>

          <div className="field">
            <label htmlFor={`leg-${i}-to`}>To (arrival)</label>
            <LocationAutocomplete
              id={`leg-${i}-to`}
              value={leg.to}
              placeholder="Narita International Airport"
              near={destination}
              onChange={(text) => updateLeg(i, { to: text })}
              onPick={(s) => updateLeg(i, { to: s.display, toLat: s.lat, toLng: s.lng })}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor={`leg-${i}-depart`}>Departs</label>
              <input
                id={`leg-${i}-depart`}
                type="time"
                className="input mono"
                value={leg.departTime}
                onChange={(e) => updateLeg(i, { departTime: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`leg-${i}-arrive`}>Arrives</label>
              <input
                id={`leg-${i}-arrive`}
                type="time"
                className="input mono"
                value={leg.arriveTime}
                onChange={(e) => updateLeg(i, { arriveTime: e.target.value })}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor={`leg-${i}-num`}>Flight # (optional)</label>
              <input
                id={`leg-${i}-num`}
                className="input mono"
                value={leg.flightNumber}
                onChange={(e) => updateLeg(i, { flightNumber: e.target.value })}
                placeholder="UA 659"
                maxLength={20}
              />
            </div>
            <div className="field">
              <label htmlFor={`leg-${i}-op`}>Operated by (optional)</label>
              <input
                id={`leg-${i}-op`}
                className="input"
                value={leg.operatedBy}
                onChange={(e) => updateLeg(i, { operatedBy: e.target.value })}
                placeholder="United Airlines"
                maxLength={100}
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="note-add-item" onClick={addLeg}>
        <span className="plus"><Icons.plus size={11} /></span>
        Add another leg
      </button>
    </div>
  );
}
