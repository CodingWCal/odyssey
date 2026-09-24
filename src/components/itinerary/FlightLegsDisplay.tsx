import { Icons } from "@/components/shared/Icons";
import { RoutePoint } from "@/components/shared/RouteLine";
import { formatTime, type TimeFormat } from "@/lib/utils";
import { computeLegDayOffsets, layoverMinutes, formatDuration, type FlightLeg } from "@/lib/flightLegs";

interface FlightLegsDisplayProps {
  legs: FlightLeg[];
  timeFormat: TimeFormat;
}

/**
 * A multi-leg flight (ODY-144) rendered as one mini "boarding pass" card per
 * leg, with the auto-computed layover shown as a dotted connector between
 * them — replaces the single RouteLine for a flight with more than one leg.
 * A single-leg flight keeps the plain RouteLine treatment (EventBlock only
 * renders this component when legs.length > 1).
 */
export function FlightLegsDisplay({ legs, timeFormat }: FlightLegsDisplayProps) {
  const offsets = computeLegDayOffsets(legs);

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
              <span className="flight-leg-time">{formatTime(leg.departTime, timeFormat)}</span>
              <span className="flight-leg-place"><RoutePoint text={leg.from} /></span>
            </div>
            <span className="flight-leg-arrow" aria-hidden="true">→</span>
            <div className="flight-leg-pt">
              <span className="flight-leg-time">
                {formatTime(leg.arriveTime, timeFormat)}
                {offsets[i].arriveDayOffset > offsets[i].departDayOffset && (
                  <sup className="flight-plusday" title="Arrives the next day">+1</sup>
                )}
              </span>
              <span className="flight-leg-place"><RoutePoint text={leg.to} /></span>
            </div>
          </div>

          {i < legs.length - 1 && (
            <div className="flight-layover">
              <Icons.transport size={11} />
              {formatDuration(layoverMinutes(legs, offsets, i))} layover in <RoutePoint text={legs[i].to} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
