import { Icons } from "@/components/shared/Icons";
import { RoutePoint } from "@/components/shared/RouteLine";
import { formatTime, type TimeFormat } from "@/lib/utils";
import { computeLegDayOffsets, layoverMinutes, formatDuration, type FlightLeg } from "@/lib/flightLegs";

function FlightLayover({ minutes, place }: { minutes: number | null; place: string }) {
  return (
    <div className="flight-layover">
      <Icons.transport size={11} />
      {minutes != null ? `${formatDuration(minutes)} layover in` : "Layover in"} <RoutePoint text={place} />
    </div>
  );
}

interface FlightLegsDisplayProps {
  legs: FlightLeg[];
  timeFormat: TimeFormat;
}

/**
 * A flight (ODY-144/145) rendered as one mini "boarding pass" card per leg,
 * with the auto-computed layover shown as a dotted connector between them.
 * Every flight with a route gets this, one leg or many. Older flights can be
 * missing a time — shown as "—" (matching the event-time rail), never guessed.
 */
export function FlightLegsDisplay({ legs, timeFormat }: FlightLegsDisplayProps) {
  const offsets = computeLegDayOffsets(legs);
  const time = (hhmm: string) => (hhmm ? formatTime(hhmm, timeFormat) : "—");

  return (
    <div className="flight-legs">
      {legs.map((leg, i) => (
        <div className="flight-leg" key={i}>
          {(leg.flightNumber || leg.operatedBy) && (
            <div className="flight-leg-head">
              {leg.flightNumber && <span className="flight-leg-num">{leg.flightNumber}</span>}
              {leg.operatedBy && <span className="flight-leg-op">Operated by {leg.operatedBy}</span>}
            </div>
          )}
          <div className="flight-leg-route">
            <div className="flight-leg-pt">
              <span className="flight-leg-time">{time(leg.departTime)}</span>
              <span className="flight-leg-place"><RoutePoint text={leg.from} /></span>
            </div>
            <span className="flight-leg-arrow" aria-hidden="true">→</span>
            <div className="flight-leg-pt">
              <span className="flight-leg-time">
                {time(leg.arriveTime)}
                {offsets[i].arriveDayOffset > offsets[i].departDayOffset && (
                  <sup className="flight-plusday" title="Arrives the next day">+1</sup>
                )}
              </span>
              <span className="flight-leg-place"><RoutePoint text={leg.to} /></span>
            </div>
          </div>

          {i < legs.length - 1 && (
            <FlightLayover minutes={layoverMinutes(legs, offsets, i)} place={legs[i].to} />
          )}
        </div>
      ))}
    </div>
  );
}
